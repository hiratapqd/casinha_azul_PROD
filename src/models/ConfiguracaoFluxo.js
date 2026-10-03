const mongoose = require('mongoose');

const ConfiguracaoFluxoSchema = new mongoose.Schema({
    terapia: { type: String, required: true, unique: true },
    geraPasseAoFinalizar: { type: Boolean, default: false },
    requerSolicitacaoPrevia: { type: Boolean, default: true },
    intervalo_dias: { type: Number, default: 27, min: 0 },
    intervalo_sem_retorno_dias: { type: Number, default: 90, min: 0 }
}, { collection: 'configuracoesfluxo' });

module.exports = mongoose.model('ConfiguracaoFluxo', ConfiguracaoFluxoSchema);
