const mongoose = require('mongoose');

const SolicitacaoSchema = new mongoose.Schema({
    _id: { type: String }, // CPF_YYYY-MM-DD
    nome_assistido: { type: String, required: true },
    idade_assistido: Number, // Calculado no controller
    sendo_atendido: String, 
    queixa_motivo: String,
    data_pedido: { type: Date, default: Date.now },
    posicao: Number,
    status: { type: String, default: 'Confirmado' }
}, { 
    collection: 'solicitacoes'
});

module.exports = mongoose.model('Solicitacao', SolicitacaoSchema);