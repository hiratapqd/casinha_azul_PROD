const Atendimento = require('../models/Atendimento');
const Solicitacao = require('../models/Solicitacao');

function transacoesIndisponiveis(erro) {
    return Number(erro.code ?? erro.errorResponse?.code) === 20 &&
        /Transaction numbers are only allowed on a replica set member or mongos/i.test(erro.message || erro.errorResponse?.errmsg || '');
}

async function salvarSemTransacao({ dadosAtendimento, solicitacao, encaminharPasse, hoje }) {
    const atendimento = new Atendimento(dadosAtendimento);
    await atendimento.validate();
    let reservada = false;
    const idPasse = `${atendimento.cpf_assistido}_passe_${hoje}`;
    try {
        if (solicitacao) {
            const anterior = await Solicitacao.findOneAndUpdate({
                _id: solicitacao._id, status: { $in: ['Confirmado', 'Aguardando', 'Espera', 'Em Atendimento'] }
            }, { $set: { status: 'Finalizando', finalizacao_atendimento: atendimento._id } }, { returnDocument: 'before' });
            if (!anterior) { const e = new Error('Essa solicitação já está sendo finalizada ou foi concluída. Atualize a fila.'); e.status = 409; throw e; }
            reservada = true;
        }
        await atendimento.save();
        if (encaminharPasse) {
            await Solicitacao.findOneAndUpdate({ _id: idPasse }, { $setOnInsert: {
                nome_assistido: atendimento.nome_assistido, tipo: 'passe', status: 'Confirmado',
                data_pedido: new Date(), sendo_atendido: 'Vindo do(a) apometria',
                passe_pos_apometria: true, apometria_origem: atendimento._id,
                finalizacao_atendimento: atendimento._id
            } }, { upsert: true });
        }
        if (solicitacao) {
            const finalizada = await Solicitacao.findOneAndUpdate({
                _id: solicitacao._id, status: 'Finalizando', finalizacao_atendimento: atendimento._id
            }, { $set: { status: 'Atendido' } }, { returnDocument: 'after' });
            if (!finalizada) throw new Error('Não foi possível confirmar a finalização da solicitação.');
        }
    } catch (erro) {
        if (!reservada && solicitacao) throw erro;
        // As remoções se limitam aos registros desta tentativa. Um passe que
        // já existia, ou já começou a ser atendido, não é apagado.
        const falhas = [];
        async function recuperar(fn) { try { await fn(); } catch (e) { falhas.push(e); } }
        await recuperar(() => Solicitacao.deleteOne({ _id: idPasse, tipo: 'passe', status: 'Confirmado', finalizacao_atendimento: atendimento._id }));
        await recuperar(() => Atendimento.deleteOne({ _id: atendimento._id }));
        // Só libera nova tentativa se toda a recuperação terminou. Se o banco
        // continuar indisponível, mantém a reserva para evitar duplicação.
        if (reservada && !falhas.length) await recuperar(() => Solicitacao.updateOne({
            _id: solicitacao._id, finalizacao_atendimento: atendimento._id, status: { $in: ['Finalizando', 'Atendido'] }
        }, { $set: { status: solicitacao.status }, $unset: { finalizacao_atendimento: 1 } }));
        if (falhas.length) {
            console.error('Recuperação incompleta da apometria:', atendimento._id, falhas.map(e => e.name));
            erro.message = 'A gravação falhou e a recuperação não foi concluída. Verifique a solicitação antes de tentar novamente.';
        }
        throw erro;
    }
}
module.exports = { salvarSemTransacao, transacoesIndisponiveis };
