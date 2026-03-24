const Assistido = require('../models/Assistido');

exports.criarAssistido = async (req, res) => {
    try {
        // const { cpf, nome, telefone, email } = req.body;
        const dados = req.body;

        // 1. Verifica se o assistido já existe (usando o CPF como _id)
        const cpfLimpo = dados.cpf ? dados.cpf.replace(/\D/g, '') : null;
        if (!cpfLimpo) {
            return res.status(400).json({ status: 'erro', mensagem: 'CPF é obrigatório' });
        }
        const assistidoExistente = await Assistido.findById(cpfLimpo);

        if (assistidoExistente) {
            return res.json({ 
                status: 'existente', 
                nome: assistidoExistente.nome_assistido
            });
        }

        // 2. Prepara os dados conforme o seu esquema original
        const novoAssistido = new Assistido({
            _id: cpfLimpo,
            nome_assistido: dados.nome,
            telefone_assistido: dados.telefone,
            data_nascimento_assistido: dados.data_nascimento,
            sexo_assistido: dados.sexo,
            religiao_assistido: dados.religiao,
            cidade_assistido: dados.cidade,
            uf_assistido: dados.uf,
            email_assistido: dados.email,
            status: "Ativo",
            data_cadastro: new Date().toISOString().split('T')[0]
        });

        // 3. Salva no banco de dados casinha_azul
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

// Rota para renderizar a página de formulário
exports.renderFormCadastro = (req, res) => {
    res.render('cadastro_assistidos');
};