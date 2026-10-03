const Solicitacao = require('../models/Solicitacao');
const Assistido = require('../models/Assistido');
const { listarConfiguracoes } = require('../services/ConfiguracaoOperacao');
const { hojeLocal, inicioDia, fimDia, diaSemana, DIAS } = require('../utils/operacao');

exports.exibirPaginaRecepcao = async (req, res) => {
    try {
        const configs = (await listarConfiguracoes()).filter(c => c.ativa && !c.grupo).map(c => ({ terapia: c.id, nome: c.nome }));
        res.render('recepcao', { configs });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao carregar recepcao');
    }
};

exports.realizarCheckin = async (req, res) => {
    try {
        let { cpf, nome, queixa, terapias } = req.body;
        const hoje = hojeLocal();
        cpf = String(cpf || '').replace(/\D/g, '');
        const assistido = await Assistido.findById(cpf).lean();
        if (cpf.length !== 11 || !assistido) return res.status(400).json({ error: 'Selecione um assistido cadastrado.' });
        nome = assistido.nome_assistido;

        if (!Array.isArray(terapias)) {
            terapias = [terapias];
        }
        terapias = [...new Set(terapias)];
        const configs = await listarConfiguracoes();
        if (!terapias.length || terapias.some(t => t === 'apometria' || !configs.some(c => c.id === t && c.ativa && !c.grupo))) {
            return res.status(400).json({ error: 'Selecione ao menos uma terapia complementar ativa.' });
        }
        for (const terapia of terapias) {
            if (await Solicitacao.exists({ _id: `${cpf}_${terapia}_${hoje}` })) continue;
            const config = configs.find(c => c.id === terapia);
            const principal = config.limites[DIAS[diaSemana(hoje)]] ?? config.limite_principal;
            const espera = config.limites_espera[DIAS[diaSemana(hoje)]] ?? config.limite_espera;
            if (principal !== null && principal !== undefined) {
                const total = await Solicitacao.countDocuments({ tipo: terapia, data_pedido: { $gte: inicioDia(hoje), $lte: fimDia(hoje) }, status: { $ne: 'Cancelado' } });
                if (principal === 0 || total >= principal + espera) return res.status(400).json({ error: `Não há vagas disponíveis para ${config.nome}.` });
            }
        }

        const promessas = terapias.map(async (terapia) => {
            const idComposto = `${cpf}_${terapia}_${hoje}`;
            const config = configs.find(c => c.id === terapia);
            const principal = config.limites[DIAS[diaSemana(hoje)]] ?? config.limite_principal;
            const total = principal === null || principal === undefined ? 0 : await Solicitacao.countDocuments({ tipo: terapia, data_pedido: { $gte: inicioDia(hoje), $lte: fimDia(hoje) }, status: { $ne: 'Cancelado' } });

            return Solicitacao.findOneAndUpdate(
                { _id: idComposto },
                { $setOnInsert: {
                    nome_assistido: nome,
                    data_pedido: new Date(),
                    status: principal !== null && principal !== undefined && total >= principal ? 'Espera' : 'Aguardando',
                    tipo: terapia,
                    queixa_motivo: queixa
                } },
                { upsert: true, returnDocument: 'after' }
            );
        });

        await Promise.all(promessas);
        res.status(200).json({ status: 'ok' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
