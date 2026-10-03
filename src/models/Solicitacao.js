const mongoose = require('mongoose');

const SolicitacaoSchema = new mongoose.Schema({
    finalizacao_atendimento: { type: mongoose.Schema.Types.ObjectId, ref: 'Atendimento' },
    passe_pos_apometria: { type: Boolean },
    apometria_origem: { type: mongoose.Schema.Types.ObjectId, ref: 'Atendimento' },
    _id: { type: String }, // CPF_YYYY-MM-DD
    nome_assistido: { type: String, required: true },
    idade_assistido: Number,
    sendo_atendido: String, 
    queixa_motivo: String,
    data_pedido: { type: Date, default: Date.now },
    tipo: { type: String, default: 'apometria' },
    posicao: Number,
    status: { type: String, default: 'Confirmado' }
}, { 
    collection: 'solicitacoes'
});

module.exports = mongoose.model('Solicitacao', SolicitacaoSchema);
