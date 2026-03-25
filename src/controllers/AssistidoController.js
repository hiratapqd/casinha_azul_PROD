const Assistido = require('../models/Assistido');

exports.criarAssistido = async (req, res) => {
    
    try {
        const dados = req.body;
        // 1. Verifica se o assistido já existe (usando o CPF como _id)
        const cpfLimpo = (dados.cpf_assistido || dados.cpf) ? (dados.cpf_assistido || dados.cpf).replace(/\D/g, '') : null;
        if (!cpfLimpo) {
            return res.status(400).json({ status: 'erro', mensagem: 'CPF é obrigatório' });
        }
        // 2. Verifica se o assistido já existe
        const assistidoExistente = await Assistido.findById(cpfLimpo);

        if (assistidoExistente) {
            return res.json({ 
                status: 'existente', 
                nome: assistidoExistente.nome_assistido
            });
        }

        // 3. Prepara os dados conforme o seu esquema original
        const novoAssistido = new Assistido({
            _id: cpfLimpo,
            nome_assistido: dados.nome_assistido,
            telefone_assistido: dados.telefone_assistido,
            data_nascimento_assistido: dados.data_nascimento_assistido,
            sexo_assistido: dados.sexo_assistido,
            religiao_assistido: dados.religiao_assistido,
            cidade_assistido: dados.cidade_assistido,
            uf_assistido: dados.uf_assistido,
            email_assistido: dados.email_assistido,
            status: "Ativo",
            dataCadastro: new Date().toISOString().split('T')[0]
        });

        // 4. Salva no banco de dados casinha_azul
        await novoAssistido.save();
        
        res.json({ status: 'sucesso' });

    } catch (err) {
        console.error("❌ Erro ao cadastrar assistido:", err);
        res.status(500).json({ 
            status: 'erro', 
            mensagem: 'Erro interno ao processar cadastro.' 
        });
    }
};

exports.renderFormCadastro = (req, res) => {
    res.render('cadastro_assistidos');
};