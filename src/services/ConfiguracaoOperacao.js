const mongoose = require('mongoose');
const ConfiguracaoFluxo = require('../models/ConfiguracaoFluxo');
const LimiteAtendimento = require('../models/LimiteAtendimento');
const { MODALIDADES } = require('../utils/operacao');
async function listarConfiguracoes() {
    const [terapias, fluxos, limites] = await Promise.all([
        mongoose.connection.db.collection('terapias').find({}).toArray(),
        ConfiguracaoFluxo.find().lean(), LimiteAtendimento.find().lean()
    ]);
    return MODALIDADES.map(modalidade => {
        const terapia = terapias.find(t => t.terapia === modalidade.id || t.slug === modalidade.slug || t.slug === modalidade.id);
        const fluxo = fluxos.find(f => f.terapia === modalidade.id);
        const limite = limites.find(l => l.tipo === modalidade.id);
        return { ...modalidade, ativa: terapia ? terapia.ativa !== false : true,
            geraPasseAoFinalizar: !modalidade.grupo && (fluxo ? Boolean(fluxo.geraPasseAoFinalizar) : false),
            requerSolicitacaoPrevia: !modalidade.grupo && (fluxo ? fluxo.requerSolicitacaoPrevia !== false : true),
            intervalo_dias: fluxo?.intervalo_dias ?? 27,
            intervalo_sem_retorno_dias: fluxo?.intervalo_sem_retorno_dias ?? 90,
            limite_principal: limite ? (limite.limite_principal ?? null) : (modalidade.id === 'apometria' ? 8 : null),
            limite_espera: limite?.limite_espera ?? 0,
            limites_espera: limite?.limites_espera || {},
            limites: limite?.limites || {}, terapiaId: terapia?._id };
    });
}
module.exports = { listarConfiguracoes };
