const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    data: { type: String, required: true, index: true },
    modalidade: { type: String, required: true },
    inicio: { type: String, required: true },
    fim: { type: String, required: true },
    cpf_voluntario: { type: String, required: true },
    cpf_substituto: { type: String, default: '' },
    motivo_substituicao: String,
    observacoes: String,
    reservas: { type: [String], default: undefined },
    status: { type: String, enum: ['Confirmado', 'Ausente'], default: 'Confirmado' }
}, { collection: 'escalas_datas', timestamps: true });
schema.index({ data: 1, cpf_voluntario: 1, inicio: 1 }, { unique: true });
schema.index({ reservas: 1 }, { unique: true, sparse: true });
module.exports = mongoose.model('EscalaData', schema);
