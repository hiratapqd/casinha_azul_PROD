const mongoose = require('mongoose');

const SolicitacaoSchema = new mongoose.Schema({
    data_pedido: { type: Date, default: Date.now },
    cpf_assistido: { type: String, required: true },
    nome_assistido: { type: String, required: true },
    tipo_atendimento: { type: String, default: 'apometrico' },
    status: { type: String, default: 'Pendente' }, // Pendente, Agendado, Concluído
    observacoes: { type: String }
}, { collection: 'solicitacoes' });

module.exports = mongoose.model('Solicitacao', SolicitacaoSchema);