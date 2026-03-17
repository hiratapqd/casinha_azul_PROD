// src/controllers/AtendimentoController.js
const Atendimento = require('../models/Atendimento');
const Solicitacao = require('../models/Solicitacao');
const Assistido = require('../models/Assistido');

exports.salvarAtendimento = async (req, res) => {
    try {
        const dados = req.body;
        const dataLocal = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
        const idSolicitacao = `${dados.cpf_assistido}_${dataLocal}`;

        // 1. Grava na collection 'atendimentos'
        const novoAtendimento = new Atendimento({
            data: new Date(),
            cpf_assistido: dados.cpf_assistido,
            nome_assistido: dados.nome_assistido,
            voluntario: dados.voluntario,
            observacoes: dados.observacoes,
            tipo: dados.tipo // Ex: 'apometrico'
        });
        await novoAtendimento.save();

        // 2. Atualiza a solicitação para 'Atendido'
        await Solicitacao.findByIdAndUpdate(idSolicitacao, { status: 'Atendido' });

        res.status(200).json({ status: 'sucesso' });
    } catch (err) {
        console.error("Erro ao salvar atendimento:", err);
        res.status(500).json({ status: 'erro', mensagem: err.message });
    }
};

exports.getHistoricoPorCPF = async (req, res) => {
    try {
        const { cpf, tipo } = req.params;
        
        // 1. Busca atendimentos anteriores
        const historico = await Atendimento.find({ cpf_assistido: cpf, tipo: tipo })
            .sort({ data: -1 })
            .limit(12).lean();

        // 2. Busca a Queixa de hoje (Construindo o ID: CPF_ANO-MES-DIA)
        const hoje = new Date().toISOString().split('T')[0];
        const idSolicitacao = `${cpf}_${hoje}`;
        
        const solicitacao = await Solicitacao.findById(idSolicitacao).lean();

        res.json({
            historico: historico,
            // Se não achar pelo ID composto, tentamos uma busca geral por CPF com status não atendido
            queixa_atual: solicitacao ? solicitacao.queixa_motivo : ""
        });
    } catch (err) {
        console.error("Erro ao buscar histórico/queixa:", err);
        res.status(500).json({ historico: [], queixa_atual: "" });
    }
};

/* exports.getDadosIniciais = async (req, res) => {
    try {
        const cpfLimpo = req.params.cpf.replace(/\D/g, '');
         const assistido = await Assistido.findById(req.params.cpf).lean();
        //const assistido = await Assistido.findOne({ cpf_assistido: req.params.cpf }).lean();
        
        if (!assistido) {
            console.log("Assistido não encontrado para o ID (CPF):", cpfLimpo);
            return res.status(404).json(null);
        }
        res.json(assistido); 
    } catch (err) {
        console.error("Erro ao buscar dados iniciais:", err);
        res.status(500).json(null);
    }
};
 */
exports.getDadosIniciais = async (req, res) => {
    try {
        const cpf = req.params.cpf;
        
        // Tentativa 1: Buscar pelo _id (Já que seu CPF é o _id)
        let assistido = await Assistido.findById(cpf).lean();

        // Tentativa 2: Se não achar, busca pelo campo cpf_assistido (segurança)
        if (!assistido) {
            assistido = await Assistido.findOne({ cpf_assistido: cpf }).lean();
        }
        
        if (!assistido) {
            return res.status(404).json(null);
        }

        // Garante que o objeto tenha o campo nome_assistido para o front-end
        res.json(assistido);
    } catch (err) {
        console.error("Erro ao buscar assistido:", err);
        res.status(500).json(null);
    }
};