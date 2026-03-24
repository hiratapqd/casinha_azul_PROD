const mongoose = require('mongoose');

const ConfiguracaoFluxoSchema = new mongoose.Schema({
    terapia: { type: String, required: true, unique: true },
    geraPasseAoFinalizar: { type: Boolean, default: false },
    requerSolicitacaoPrevia: { type: Boolean, default: true }
}, { collection: 'configuracoesfluxo' });

module.exports = mongoose.model('ConfiguracaoFluxo', ConfiguracaoFluxoSchema);