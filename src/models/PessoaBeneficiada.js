const mongoose = require('mongoose');
module.exports = new mongoose.Schema({
    participante_id: { type: String, required: true },
    nome: { type: String, required: true },
    cpf: String,
    parentesco: String
}, { _id: false });
