const mongoose = require('mongoose');

const AtendimentoSchema = new mongoose.Schema({
    data: { type: Date, required: true },
    cpf_assistido: { type: String, required: true },
    nome_assistido: { type: String },
    voluntario: { type: String, required: true },
    observacoes: { type: String },
    tipo: { type: String, required: true }
}, { 
    collection: 'atendimento' 
});

module.exports = mongoose.model('Atendimento', AtendimentoSchema);