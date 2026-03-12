// src/controllers/SolicitacaoController.js
const Solicitacao = require('../models/Solicitacao');
const Assistido = require('../models/Assistido');

exports.criarSolicitacao = async (req, res) => {
    try {
        const { cpf_assistido, queixa, atendimento_por } = req.body;

        const assistido = await Assistido.findById(cpf_assistido);
        if (!assistido) {
            return res.json({ status: 'nao_encontrado' });
        }

        // --- AJUSTE DEFINITIVO DE TIMEZONE (BRASÍLIA UTC-3) ---
        const agora = new Date();
        
        // Criamos o início do dia (00:00:00) no fuso de Brasília, convertido para UTC
        const hojeInicio = new Date(agora);
        hojeInicio.setUTCHours(agora.getUTCHours() - 3); // Ajusta para Brasília
        hojeInicio.setUTCHours(3, 0, 0, 0); // Define meia-noite em Brasília (que é 03:00 UTC)

        const hojeFim = new Date(hojeInicio);
        hojeFim.setUTCHours(26, 59, 59, 999); // Define o fim do dia (23:59 Brasília / 02:59 UTC do dia seguinte)
        // -----------------------------------------------------

        // 1. Validar Duplicidade no intervalo real de Brasília
        const jaSolicitouHoje = await Solicitacao.findOne({
            cpf_assistido: cpf_assistido,
            data: { $gte: hojeInicio, $lte: hojeFim }
        });

        if (jaSolicitouHoje) {
            return res.json({ 
                status: 'duplicado', 
                mensagem: `O assistido ${assistido.nome} já possui uma solicitação hoje na posição ${jaSolicitouHoje.posicao}.` 
            });
        }

        // 2. Contar a Fila corretamente
        const contagemHoje = await Solicitacao.countDocuments({
            data: { $gte: hojeInicio, $lte: hojeFim }
        });

        const limiteMax = 30;
        const posicaoFila = contagemHoje + 1;

        const novaSolicitacao = new Solicitacao({
            cpf_assistido: cpf_assistido,
            nome_assistido: assistido.nome,
            queixa: queixa,
            atendimento_por: atendimento_por,
            posicao: posicaoFila,
            status: posicaoFila <= limiteMax ? 'Confirmado' : 'Espera',
            data: agora 
        });

        await novaSolicitacao.save();

        res.json({
            status: 'sucesso',
            posicao: posicaoFila,
            limite: limiteMax,
            nome: assistido.nome
        });

    } catch (err) {
        console.error("❌ Erro:", err.message);
        res.status(500).json({ status: 'erro', mensagem: err.message });
    }
};