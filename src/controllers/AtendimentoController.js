const Atendimento = require('../models/Atendimento');
const Solicitacao = require('../models/Solicitacao');
const Assistido = require('../models/Assistido');
const ConfiguracaoFluxo = require('../models/ConfiguracaoFluxo');

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
        const cpfAssistido = normalizarCpf(dados.cpf_assistido);
        const hoje = new Date().toISOString().split('T')[0];
        const idSolicitacaoAtual = dados.idSolicitacao || `${cpfAssistido}_${hoje}`;

        const novoAtendimento = new Atendimento({
            data: new Date(),
            cpf_assistido: cpfAssistido,
            nome_assistido: dados.nome_assistido,
            voluntario: dados.voluntario,
            observacoes: dados.observacoes,
            tipo: dados.tipo
        });
        await novoAtendimento.save();

        const solicitacaoAtualizada = await Solicitacao.findByIdAndUpdate(
            idSolicitacaoAtual,
            { status: 'Atendido' },
            { new: true }
        );

        if (!solicitacaoAtualizada) {
            await Solicitacao.findOneAndUpdate(
                {
                    tipo: dados.tipo,
                    _id: new RegExp(`^${cpfAssistido}(?:_${dados.tipo})?_${hoje}$`)
                },
                { status: 'Atendido' }
            );
        }

        const config = await ConfiguracaoFluxo.findOne({ terapia: dados.tipo });

        if (config && config.geraPasseAoFinalizar) {
            const dataLocal = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
            const idPasse = `${cpfAssistido}_passe_${dataLocal}`;

            const jaTemPasse = await Solicitacao.findById(idPasse);

            if (!jaTemPasse) {
                const novaFilaPasse = new Solicitacao({
                    _id: idPasse,
                    nome_assistido: dados.nome_assistido,
                    tipo: 'passe',
                    status: 'Confirmado',
                    data_pedido: new Date(),
                    sendo_atendido: `Vindo do(a) ${dados.tipo}`
                });
                await novaFilaPasse.save();
            }
        }

        res.status(200).json({ status: 'sucesso' });
    } catch (err) {
        console.error('Erro ao salvar atendimento:', err);
        res.status(500).json({ status: 'erro', mensagem: err.message });
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

        console.log(`[Historico] tipo=${tipo} cpf=${cpf} encontrados=${historico.length}`);

        const hoje = new Date().toISOString().split('T')[0];
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
