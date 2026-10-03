const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    _id: { type: String, required: true }, // Um encontro por data civil GMT-3.
    responsavel_cpf: { type: String, required: true },
    responsavel_nome: { type: String, required: true },
    participantes: [{ _id: false, participante_id: String, cpf: String,
        nome: { type: String, required: true }, papel: { type: String, enum: ['Atendido', 'Assistido', 'Familiar'] },
        vinculo_id: String, vinculo_nome: String }],
    observacoes: String,
    versao: { type: Number, default: 0 }
}, { collection: 'encontros_gappus', timestamps: true });
schema.index({ 'participantes.cpf': 1, _id: -1 });
schema.index({ 'participantes.participante_id': 1, _id: -1 });
module.exports = mongoose.model('EncontroGappus', schema);
