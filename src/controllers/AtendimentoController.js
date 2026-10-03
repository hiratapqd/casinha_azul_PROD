const Atendimento = require('../models/Atendimento');
const Solicitacao = require('../models/Solicitacao');
const Assistido = require('../models/Assistido');
const mongoose = require('mongoose');
const { obterPlanoApometria, registrarPlanoApometria } = require('../services/PlanosApometria');
const { salvarSemTransacao, transacoesIndisponiveis } = require('../services/ApometriaSemTransacao');
const { listarConfiguracoes } = require('../services/ConfiguracaoOperacao');
const { hojeLocal, inicioDia, dataValida, texto } = require('../utils/operacao');
const { resolverPessoa } = require('../services/ParticipantesGappus');

function normalizarCpf(cpf = '') {
    return String(cpf).replace(/\D/g, '');
}

function criarRegexCpfFlexivel(cpf = '') {
    const cpfLimpo = normalizarCpf(cpf);
    if (!cpfLimpo) return null;

    return new RegExp(`^\\D*${cpfLimpo.split('').join('\\D*')}\\D*$`);
}

exports.getDadosIniciais = async (req, res) => {
    try {
        const cpf = normalizarCpf(req.params.cpf);

        let assistido = await Assistido.findById(cpf).lean();
        if (!assistido) {
            assistido = await Assistido.findOne({ cpf_assistido: cpf }).lean();
        }

        if (!assistido) {
            return res.status(404).json(null);
        }

        res.json(assistido);
    } catch (err) {
        console.error('Erro ao buscar assistido:', err);
        res.status(500).json(null);
    }
};

exports.salvarAtendimento = async (req, res) => {
    try {
        const dados = req.body;
        const paraTerceiro = dados.tipo === 'apometria' && dados.para_terceiro === 'on';
        const modeloPlano = dados.tipo === 'apometria' ? await obterPlanoApometria(dados.plano_acompanhamento || (paraTerceiro ? 'plano_4' : undefined)) : null;
        const cpfAssistido = normalizarCpf(dados.cpf_assistido);
        const hoje = hojeLocal();
        const configs = await listarConfiguracoes();
        const configOperacao = configs.find(c => c.id === dados.tipo);
        if (!configOperacao) return res.status(400).json({ status: 'erro', mensagem: 'Modalidade inválida.' });
        if (configOperacao.grupo) return res.status(400).json({ status: 'erro', mensagem: 'Registre o GAPPUS na lista de presença por encontro.' });
        const adicionais = {};
        if (paraTerceiro) {
            if (modeloPlano.metas.some(m => m.terapia !== 'passe')) return res.status(400).json({ status: 'erro', mensagem: 'Na apometria em intenção de outra pessoa, selecione o Plano 4, somente passes.' });
            let nome = texto(dados.beneficiario_nome, 150);
            let cpf = texto(dados.beneficiario_cpf, 20).replace(/\D/g, '');
            if (!nome || (cpf && cpf.length !== 11) || (cpf && cpf === cpfAssistido)) return res.status(400).json({ status: 'erro', mensagem: 'Informe o nome do assistido beneficiado e, se disponível, seu CPF com 11 dígitos, diferente do atendido.' });
            let pessoa = null;
            if (dados.beneficiario_id) {
                pessoa = await resolverPessoa(texto(dados.beneficiario_id, 24));
                if (!pessoa) return res.status(400).json({ status: 'erro', mensagem: 'O assistido selecionado não foi encontrado. Selecione novamente.' });
                nome = pessoa.nome; cpf = pessoa.cpf || '';
                if (cpf === cpfAssistido) return res.status(400).json({ status: 'erro', mensagem: 'O assistido beneficiado deve ser diferente do atendido.' });
            }
            adicionais.para_terceiro = true;
            adicionais.beneficiario = { participante_id: pessoa?.id || cpf || new mongoose.Types.ObjectId().toString(), nome,
                ...(cpf ? { cpf } : {}), parentesco: texto(dados.beneficiario_parentesco, 80) };
        }
        if (modeloPlano) {
            for (const [modalidade, campo] of [['homeopatia', 'homeopatia_indicada'], ['gappus', 'gappus_indicado']]) {
                adicionais[campo] = dados[campo] === 'on';
                if (adicionais[campo] && !configs.find(c => c.id === modalidade)?.ativa) {
                    return res.status(400).json({ status: 'erro', mensagem: `Ative ${modalidade === 'gappus' ? 'GAPPUS' : 'Homeopatia'} nas configurações antes de indicar esse acompanhamento.` });
                }
            }
        }
        if (dados.tipo === 'homeopatia') {
            const retorno = texto(dados.data_retorno, 10);
            if (!dataValida(retorno) || retorno <= hoje) return res.status(400).json({ status: 'erro', mensagem: 'Informe uma data de retorno de homeopatia posterior a hoje.' });
            adicionais.data_retorno = retorno;
        }
        const solicitacao = await Solicitacao.findOne({
            tipo: dados.tipo,
            _id: new RegExp(`^${cpfAssistido}(?:_${dados.tipo})?_${hoje}$`),
            status: { $in: ['Confirmado', 'Aguardando', 'Espera', 'Em Atendimento'] }
        }).lean();
        if (!configOperacao.ativa && !solicitacao) return res.status(400).json({ status: 'erro', mensagem: 'Modalidade inativa.' });
        if (configOperacao.requerSolicitacaoPrevia && !solicitacao) return res.status(400).json({ status: 'erro', mensagem: 'Registre a solicitação ou o check-in antes de finalizar o atendimento.' });
        const assistido = await Assistido.findById(cpfAssistido).lean()
            || await Assistido.findOne({ cpf_assistido: cpfAssistido }).lean();

        if (!assistido) {
            return res.status(400).json({
                status: 'erro',
                mensagem: 'O CPF informado nao possui cadastro de assistido.'
            });
        }

        const dadosAtendimento = {
            data: new Date(),
            cpf_assistido: cpfAssistido,
            nome_assistido: dados.nome_assistido || assistido.nome_assistido,
            voluntario: dados.voluntario,
            observacoes: dados.observacoes,
            tipo: dados.tipo,
            ...adicionais,
            ...(modeloPlano ? { plano_acompanhamento: modeloPlano.id } : {})
        };
        if (dados.tipo === 'passe') {
            const apometria = await Atendimento.findOne({ cpf_assistido: cpfAssistido, tipo: 'apometria',
                data: { $gte: inicioDia(hoje), $lte: dadosAtendimento.data } }).sort({ data: -1 }).lean();
            const primeiroPasse = apometria && !await Atendimento.exists({ cpf_assistido: cpfAssistido, tipo: 'passe',
                data: { $gte: apometria.data, $lte: dadosAtendimento.data } });
            dadosAtendimento.passe_pos_apometria = Boolean(solicitacao?.passe_pos_apometria ||
                /Vindo do\(a\) apometria/i.test(solicitacao?.sendo_atendido || '') || primeiroPasse);
            if (dadosAtendimento.passe_pos_apometria) dadosAtendimento.apometria_origem = solicitacao?.apometria_origem || apometria?._id;
        }
        let encaminhadoPasse = false;
        async function persistir(session) {
            const opcoes = session ? { session } : {};
            if (modeloPlano && solicitacao) {
                const atualizada = await Solicitacao.findOneAndUpdate({ _id: solicitacao._id, status: { $in: ['Confirmado', 'Aguardando', 'Espera', 'Em Atendimento'] } }, { $set: { status: 'Atendido' } }, { ...opcoes, returnDocument: 'before' });
                if (!atualizada) { const e = new Error('Essa solicitação já foi finalizada. Atualize a fila.'); e.status = 409; throw e; }
            }
            const novoAtendimento = new Atendimento(dadosAtendimento);
            await novoAtendimento.save(opcoes);
            if (modeloPlano) await registrarPlanoApometria(novoAtendimento, modeloPlano, session);
            if (solicitacao && !modeloPlano) {
                await Solicitacao.findByIdAndUpdate(solicitacao._id, { status: 'Atendido' }, opcoes);
            }
            if (configOperacao.geraPasseAoFinalizar && configs.find(c => c.id === 'passe')?.ativa) {
                const idPasse = `${cpfAssistido}_passe_${hoje}`;
                await Solicitacao.findOneAndUpdate({ _id: idPasse }, { $setOnInsert: {
                    nome_assistido: dadosAtendimento.nome_assistido, tipo: 'passe', status: 'Confirmado',
                    data_pedido: new Date(), sendo_atendido: `Vindo do(a) ${dados.tipo}`,
                    ...(modeloPlano ? { passe_pos_apometria: true, apometria_origem: novoAtendimento._id } : {})
                } }, { ...opcoes, upsert: true });
                encaminhadoPasse = true;
            }
        }
        // Usa transação quando disponível. Em MongoDB standalone, reserva a
        // solicitação e recupera as gravações desta tentativa em caso de falha.
        if (modeloPlano) {
            try { await mongoose.connection.transaction(persistir); }
            catch (erro) {
                if (!transacoesIndisponiveis(erro)) throw erro;
                const encaminharPasse = configOperacao.geraPasseAoFinalizar && configs.find(c => c.id === 'passe')?.ativa;
                await salvarSemTransacao({ dadosAtendimento, modelo: modeloPlano, solicitacao, encaminharPasse, hoje });
                encaminhadoPasse = Boolean(encaminharPasse);
            }
        }
        else await persistir();

        res.status(200).json({ status: 'sucesso', encaminhadoPasse, ...(modeloPlano ? { planoAcompanhamento: modeloPlano.nome } : {}) });
    } catch (err) {
        console.error('Erro ao salvar atendimento:', err);
        res.status(err.status || (err.name === 'ValidationError' ? 400 : 500)).json({ status: 'erro', mensagem: err.message });
    }
};

exports.getHistoricoPorTipo = async (req, res) => {
    try {
        const { tipo } = req.params;
        const cpf = normalizarCpf(req.params.cpf);
        const cpfRegex = criarRegexCpfFlexivel(cpf);

        const historico = await Atendimento.find({
            tipo,
            $or: [
                { cpf_assistido: cpf },
                ...(cpfRegex ? [{ cpf_assistido: cpfRegex }] : [])
            ]
        })
            .sort({ data: -1 })
            .lean();

        const hoje = hojeLocal();
        const solicitacao = await Solicitacao.findOne({
            tipo,
            _id: new RegExp(`^${cpf}(?:_${tipo})?_${hoje}$`)
        }).lean();

        res.json({
            historico,
            queixa_atual: solicitacao ? solicitacao.queixa_motivo : ''
        });
    } catch (err) {
        console.error('Erro ao buscar historico por tipo:', err);
        res.status(500).json({ historico: [], queixa_atual: '' });
    }
};
