const mongoose = require('mongoose');

const SolicitacaoSchema = new mongoose.Schema({
    _id: { type: String }, // CPF_DATA para evitar duplicidade
    data_pedido: { type: Date, default: Date.now },
    cpf_assistido: { type: String, required: true },
    nome_assistido: { type: String, required: true },
    sexo: String,
    idade: Number,
    religiao: String,
    cidade: String,
    uf: String,
    email: String, 
    atendimento_por: String, 
    queixa: String,
    posicao: Number,
    status: { type: String, default: 'Confirmado' },
    tipo_atendimento: { type: String, default: 'apometrico' }
}, { collection: 'solicitacoes' });

module.exports = mongoose.model('Solicitacao', SolicitacaoSchema);