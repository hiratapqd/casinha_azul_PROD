const mongoose = require('mongoose');

const TerapiaSchema = new mongoose.Schema({
    terapia: { type: String, required: true, unique: true }, // ex: "apometria", "reiki"
    limites: {
        segunda: { type: Number, default: 0 },
        terca: { type: Number, default: 0 },
        quarta: { type: Number, default: 0 },
        quinta: { type: Number, default: 0 },
        sexta: { type: Number, default: 0 },
        sabado: { type: Number, default: 0 },
        domingo: { type: Number, default: 0 }
    }
}, { collection: 'terapias' }); // Força o nome da coleção que você já usa

module.exports = mongoose.model('Terapia', TerapiaSchema);