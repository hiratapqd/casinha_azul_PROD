const mongoose = require('mongoose');

const AtendimentoSchema = new mongoose.Schema({
    data: { type: Date, required: true },
    cpf_assistido: { type: String, required: true },
    nome_assistido: { type: String },
    voluntario: { type: String, required: true },
    observacoes: { type: String },
    tipo: { type: String, required: true },
    status: { type: String, default: 'Pendente' }, 
    prioridade: { type: Number } 
}, { 
    collection: 'atendimentos'
});

// O registro do modelo deve acontecer apenas UMA VEZ ao final do arquivo
module.exports = mongoose.model('Atendimento', AtendimentoSchema);