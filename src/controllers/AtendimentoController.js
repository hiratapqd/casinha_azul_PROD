const Atendimento = require('../models/Atendimento');
const Solicitacao = require('../models/Solicitacao');
const Assistido = require('../models/Assistido');
const ConfiguracaoFluxo = require('../models/ConfiguracaoFluxo'); 

exports.getDadosIniciais = async (req, res) => {
    try {
        const cpf = req.params.cpf;
        
        // Busca pelo _id ou pelo campo cpf_assistido
        let assistido = await Assistido.findById(cpf).lean();
        if (!assistido) {
            assistido = await Assistido.findOne({ cpf_assistido: cpf }).lean();
        }
        
        if (!assistido) {
            return res.status(404).json(null);
        }

        res.json(assistido);
    } catch (err) {
        console.error("Erro ao buscar assistido:", err);
        res.status(500).json(null);
    }
};

exports.salvarAtendimento = async (req, res) => {
    try {
        const dados = req.body;
        const hoje = new Date().toISOString().split('T')[0];
        const idSolicitacaoAtual = dados.idSolicitacao || `${dados.cpf_assistido}_${hoje}`;

        // 1. Grava o histórico do atendimento atual
        const novoAtendimento = new Atendimento({
            data: new Date(),
            cpf_assistido: dados.cpf_assistido,
            nome_assistido: dados.nome_assistido,
            voluntario: dados.voluntario,
            observacoes: dados.observacoes,
            tipo: dados.tipo 
        });
        await novoAtendimento.save();

        // 2. Marca a solicitação da terapia atual como 'Atendido'
        await Solicitacao.findByIdAndUpdate(idSolicitacaoAtual, { status: 'Atendido' });

        // 3. Lógica de Fluxo Dinâmica (Passe automático)
        const config = await ConfiguracaoFluxo.findOne({ terapia: dados.tipo });

        if (config && config.geraPasseAoFinalizar) {
            const dataLocal = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
            const idPasse = `${dados.cpf_assistido}_passe_${dataLocal}`;

            const jaTemPasse = await Solicitacao.findById(idPasse);

            if (!jaTemPasse) {
                const novaFilaPasse = new Solicitacao({
                    _id: idPasse,
                    nome_assistido: dados.nome_assistido,
                    tipo: "passe",
                    status: "Confirmado",
                    data_pedido: new Date(),
                    sendo_atendido: `Vindo do(a) ${dados.tipo}`
                });
                await novaFilaPasse.save();
                // console.log(`[Fluxo] Passe gerado para ${dados.nome_assistido} vindo de ${dados.tipo}`);
            }
        }

        res.status(200).json({ status: 'sucesso' });
    } catch (err) {
        console.error("Erro ao salvar atendimento:", err);
        res.status(500).json({ status: 'erro', mensagem: err.message });
    }
};

    // Busca histórico específico para a tabela inferior
    exports.getHistoricoPorTipo = async (req, res) => {
        try {
            const { tipo, cpf } = req.params;
            const historico = await Atendimento.find({ cpf_assistido: cpf, tipo: tipo }).sort({ data: -1 }).lean();
            
            const hoje = new Date().toISOString().split('T')[0];
            const solicitacao = await Solicitacao.findById(`${cpf}_${hoje}`).lean();

            res.json({
                historico: historico,
                queixa_atual: solicitacao ? solicitacao.queixa_motivo : ""
            });
        } catch (err) {
            res.status(500).json({ historico: [], queixa_atual: "" });
        }
    };