const mongoose = require('mongoose');

const AssistidoSchema = new mongoose.Schema({
    _id: { type: String }, // CPF como ID
    nome_assistido: String,
    telefone_assistido: String,
    data_nascimento_assistido: Date,
    sexo_assistido: String,
    religiao_assistido: String,
    cidade_assistido: String,
    uf_assistido: String,
    email_assistido: String,
    status: { type: String, default: 'Ativo' },
    dataCadastro: { type: Date, default: Date.now }
}, { collection: 'assistidos'});

module.exports = mongoose.model('Assistido', AssistidoSchema);