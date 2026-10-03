const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    nome: { type: String, required: true },
    cpf: String,
    papel: { type: String, enum: ['Atendido', 'Assistido', 'Familiar'], required: true },
    vinculo_nome: String,
    vinculo_id: String,
    inclusao_manual: { type: Boolean, default: false },
    data_inicio: String,
    status: { type: String, enum: ['Ativo', 'Desistiu'], default: 'Ativo' },
    desistencia_em: Date
}, { collection: 'participantes_gappus', timestamps: true });
schema.index({ cpf: 1 }, { unique: true, partialFilterExpression: { cpf: { $type: 'string' } } });
module.exports = mongoose.model('ParticipanteGappus', schema);
