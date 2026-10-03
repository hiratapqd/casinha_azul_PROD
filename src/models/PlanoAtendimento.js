const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    _id: { type: String, required: true },
    nome: { type: String, required: true, maxlength: 100 },
    metas: { type: [{ _id: false,
        terapia: { type: String, enum: ['apometria', 'passe', 'reiki', 'auriculo'], required: true },
        sessoes_previstas: { type: Number, min: 1, max: 100, required: true }
    }], validate: { validator: metas => metas.length > 0, message: 'Informe pelo menos uma terapia.' } }
}, { collection: 'planos_atendimento', timestamps: true });
module.exports = mongoose.model('PlanoAtendimento', schema);
