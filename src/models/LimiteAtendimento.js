const mongoose = require('mongoose');

const LimiteSchema = new mongoose.Schema({
    tipo: { type: String, required: true, unique: true }, 
    limite_principal: { type: Number, default: 3 },
    limite_espera: { type: Number, default: 0 }
}, { collection: 'limite_atendimento' });

module.exports = mongoose.model('LimiteAtendimento', LimiteSchema);