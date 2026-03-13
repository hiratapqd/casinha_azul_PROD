// src/controllers/SolicitacaoController.js
const Solicitacao = require('../models/Solicitacao');
const Assistido = require('../models/Assistido');


exports.criarSolicitacaoComCadastro = async (req, res) => {
    try {
        const dados = req.body;
        const agora = new Date();
        const dataLocal = agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

        // 1. Cálculo da Idade
        const nasc = new Date(dados.data_nascimento);
        let idade = agora.getFullYear() - nasc.getFullYear();
        if (agora < new Date(agora.getFullYear(), nasc.getMonth(), nasc.getDate())) idade--;

        // 2. Gravar na Collection ASSISTIDOS (Cadastro Geral)
        // Aqui ajustamos para os nomes de campos que você espera
        await Assistido.findByIdAndUpdate(
            dados.cpf_assistido, // cpf_assistido como _id
            {
                nome_assistido: dados.nome,
                telefone_assistido: dados.telefone,
                data_nascimento_assistido: dados.data_nascimento,
                sexo_assistido: dados.sexo,
                religiao_assistido: dados.religiao,
                cidade_assistido: dados.cidade,
                uf_assistido: dados.uf,
                email_assistido: dados.email,
                status: "Ativo" // Adicionado o campo status conforme solicitado
            },
            { upsert: true, new: true }
        );

        // 3. Gerar ID Único para SOLICITAÇÕES (CPF + DATA)
        const idSolicitacao = `${dados.cpf_assistido}_${dataLocal}`;

        // 4. Lógica de Fila
        const hojeInicio = new Date(dataLocal + "T00:00:00-03:00");
        const contagem = await Solicitacao.countDocuments({ data_pedido: { $gte: hojeInicio } });
        const posicaoFila = contagem + 1;

        // 5. Gravar na Collection SOLICITACOES
        const novaSolicitacao = new Solicitacao({
            _id: idSolicitacao,
            nome_assistido: dados.nome,
            idade_assistido: idade,
            sendo_atendido: dados.atendimento_por,
            queixa_motivo: dados.queixa,
            posicao: posicaoFila,
            data_pedido: agora,
            status: posicaoFila <= 30 ? 'Confirmado' : 'Espera'
        });

        await novaSolicitacao.save();
        res.json({ status: 'sucesso', posicao: posicaoFila, limite: 30 });

    } catch (err) {
        if (err.code === 11000) {
            return res.json({ status: 'duplicado', mensagem: 'O assistido já possui uma solicitação hoje.' });
        }
        console.error("Erro no Controller:", err);
        res.status(500).json({ status: 'erro', mensagem: err.message });
    }
};

exports.buscarHistorico = async (req, res) => {
    try {
        const { cpf } = req.params;
        const historico = await Solicitacao.find({ _id: new RegExp(`^${cpf}`) })
            .sort({ data_pedido: -1 })
            .limit(12);
        res.json(historico);
    } catch (err) {
        res.status(500).json([]);
    }
};

exports.getFilaHoje = async (req, res) => {
    try {
        const inicioDia = new Date();
        inicioDia.setHours(0, 0, 0, 0);

        const fimDia = new Date();
        fimDia.setHours(23, 59, 59, 999);

        // Alterado de 'data' para 'data_pedido' para coincidir com o que é salvo
        const solicitacoes = await Solicitacao.find({
            data_pedido: { $gte: inicioDia, $lte: fimDia }
        }).sort({ data_pedido: 1 }); 

        res.render('fila_atendimento', { solicitacoes });
    } catch (error) {
        console.error("Erro ao buscar fila:", error);
        res.status(500).send("Erro ao carregar a fila.");
    }
};

exports.iniciarAtendimento = async (req, res) => {
    try {
        const { id } = req.params; // Aqui virá o seu 'cpf_001_...'
        
        // Usamos findOneAndUpdate porque o seu _id é uma String customizada
        await Solicitacao.findOneAndUpdate(
            { _id: id }, 
            { status: 'Em Atendimento' }
        );
        
        res.redirect('/fila-atendimento');
    } catch (err) {
        console.error("Erro ao iniciar atendimento:", err);
        res.status(500).send("Erro ao atualizar status.");
    }
};