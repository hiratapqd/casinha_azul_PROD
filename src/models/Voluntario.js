const mongoose = require('mongoose');

const VoluntarioSchema = new mongoose.Schema({
    _id: { type: String }, // CPF como ID
    nome: { type: String, required: true },
    telefone: { type: String },
    email: { type: String },
    mediunidade: { type: String },
    esta_ativo: { type: String, default: "Sim" },
    data_cadastro_voluntario: { 
        type: Date, 
        default: Date.now
    },
    // Armazena os arrays de dias para cada modalidade
    disponibilidade: {
        apometria: [String],
        reiki: [String],
        auriculo: [String],
        maos: [String],
        homeopatia: [String],
        passe: [String],
        cantina: [String],
        mesa: [String]
    }
});

module.exports = mongoose.model('Voluntario', VoluntarioSchema);