// src/controllers/SolicitacaoController.js
const Solicitacao = require('../models/Solicitacao');
const Assistido = require('../models/Assistido');

exports.criarSolicitacao = async (req, res) => {
    try {
        // 1. Captura EXATAMENTE os nomes definidos no name="" do seu EJS [cite: 63, 64, 65, 68, 70, 71]
        const { 
            cpf_assistido, sexo, idade, religiao, 
            cidade, uf, email, atendimento_por, queixa, subir_escada 
        } = req.body;

        // 2. Criar ID Único para evitar duplicidade no mesmo dia (Fuso Brasília)
        const dataHoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); 
        const idUnico = `${cpf_assistido}_${dataHoje}`;

        // 3. Buscar nome do assistido no cadastro base
        const assistido = await Assistido.findById(cpf_assistido);
        if (!assistido) return res.json({ status: 'nao_encontrado' });

        // 4. Lógica de Fila (Início do dia em Brasília)
        const hojeInicio = new Date(dataHoje + "T00:00:00-03:00");
        const contagem = await Solicitacao.countDocuments({
            data_pedido: { $gte: hojeInicio }
        });
        const posicaoFila = contagem + 1;

        // 5. Mapear e Salvar
        const novaSolicitacao = new Solicitacao({
            _id: idUnico,
            cpf_assistido,
            nome_assistido: assistido.nome, // Pega o nome oficial do cadastro
            sexo,
            idade,
            religiao,
            cidade,
            uf,
            email,
            atendimento_por,
            queixa,
            subir_escada,
            posicao: posicaoFila,
            status: posicaoFila <= 30 ? 'Confirmado' : 'Espera'
        });

        await novaSolicitacao.save();
        res.json({ status: 'sucesso', posicao: posicaoFila, limite: 30 });

    } catch (err) {
        if (err.code === 11000) { // Erro de ID duplicado no MongoDB
            return res.json({ 
                status: 'duplicado', 
                mensagem: 'Este CPF já realizou uma solicitação para a data de hoje.' 
            });
        }
        res.status(500).json({ status: 'erro', mensagem: err.message });
    }
};