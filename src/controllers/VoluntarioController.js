const Voluntario = require('../models/Voluntario');

// Exibir a lista de voluntários (GET)
exports.getVisualizarVoluntarios = async (req, res) => {
    try {
        // Busca todos os voluntários, ordenando por nome
        const voluntarios = await Voluntario.find().sort({ nome: 1 }).lean();
        
        res.render('visualizar_voluntarios', { 
            voluntarios: voluntarios || [] 
        });
    } catch (err) {
        console.error("❌ Erro ao buscar voluntários:", err);
        res.status(500).send("Erro ao carregar a lista de voluntários.");
    }
};

// Criar novo voluntário (POST)
exports.criarVoluntario = async (req, res) => {
    try {
        const dados = req.body;
        
        // No seu sistema original, o CPF/Identificador costuma ser a chave
        // Aqui usamos o Mongoose para salvar no banco 'casinha_azul'
        const novoVoluntario = new Voluntario(dados);
        await novoVoluntario.save();
        
        res.json({ status: 'sucesso', mensagem: 'Voluntário cadastrado com sucesso!' });
    } catch (err) {
        console.error("❌ Erro ao salvar voluntário:", err);
        res.status(500).json({ status: 'erro', mensagem: err.message });
    }
};

// Renderizar o formulário de cadastro (GET)
exports.renderFormCadastro = (req, res) => {
    res.render('cadastro_mediuns');
};