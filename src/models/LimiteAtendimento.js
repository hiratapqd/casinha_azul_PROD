const mongoose = require('mongoose');

const LimiteSchema = new mongoose.Schema({
    tipo: { type: String, required: true, unique: true }, 
    limite_principal: { type: Number },
    limite_espera: { type: Number, default: 0 },
    limites: {
        segunda: Number,
        terca: Number,
        quarta: Number,
        quinta: Number,
        sexta: Number,
        sabado: Number,
        domingo: Number
    }
}, { collection: 'limite_atendimento' });

module.exports = mongoose.model('LimiteAtendimento', LimiteSchema);