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
        
        // Busca o histórico
        const historico = await Atendimento.find({ cpf_assistido: cpf, tipo: tipo })
            .sort({ data: -1 })
            .limit(12);

        // Busca os dados cadastrais do assistido para retornar o nome atualizado
        const assistidoDoc = await Assistido.findById(cpf);

        // Retorna um objeto estruturado que o seu reiki.ejs espera
        res.json({
            assistido: { nome: assistidoDoc ? assistidoDoc.nome_assistido : (historico[0]?.nome_assistido || "") },
            historico: historico
        });
    } catch (err) {
        console.error("Erro no histórico:", err);
        res.status(500).json({ assistido: { nome: "" }, historico: [] });
    }
};

exports.getDadosIniciais = async (req, res) => {
    try {
        const { cpf } = req.params;
        const dataLocal = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
        const idSolicitacao = `${cpf}_${dataLocal}`;

        const assistido = await Assistido.findById(cpf);
        const solicitacao = await Solicitacao.findById(idSolicitacao);

        let idade = "";
        if (assistido && assistido.data_nascimento_assistido) {
            const nasc = new Date(assistido.data_nascimento_assistido);
            const hoje = new Date();
            idade = hoje.getFullYear() - nasc.getFullYear();
            if (hoje < new Date(hoje.getFullYear(), nasc.getMonth(), nasc.getDate())) idade--;
        }

        res.json({
            nome: assistido ? assistido.nome_assistido : "",
            religiao: assistido ? assistido.religiao_assistido : "",
            idade: idade,
            // Adicionado o campo sendo_atendido vindo da solicitação
            sendo_atendido: solicitacao ? solicitacao.sendo_atendido : "", 
            queixa_dia: solicitacao ? solicitacao.queixa_motivo : "" 
        });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
};