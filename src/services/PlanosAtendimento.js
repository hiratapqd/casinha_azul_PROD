const Plano = require('../models/PlanoAtendimento');
const PADRAO = 'passes';
const meta = terapia => ({ terapia, sessoes_previstas: 3 });
const PLANOS_ATENDIMENTO = [
    { id: PADRAO, nome: '3 passes', metas: [meta('passe')] },
    { id: 'passes_reiki', nome: '3 passes + 3 Reiki', metas: [meta('passe'), meta('reiki')] },
    { id: 'passes_reiki_auriculo', nome: '3 passes + 3 Reiki + 3 Aurículo', metas: [meta('passe'), meta('reiki'), meta('auriculo')] },
    { id: 'passes_auriculo', nome: '3 passes + 3 Aurículo', metas: [meta('passe'), meta('auriculo')] }
];
function descrever(metas) {
    const nomes = { apometria: 'Apometria', passe: 'Passe', reiki: 'Reiki', auriculo: 'Aurículo' };
    return metas.map(m => `${m.sessoes_previstas} ${nomes[m.terapia]}`).join(' + ');
}
async function listarPlanosAtendimento() {
    const personalizados = await Plano.find().sort({ createdAt: 1, _id: 1 }).lean();
    return [...PLANOS_ATENDIMENTO.map(p => ({ ...p, fixo: true })),
        ...personalizados.map(p => ({ id: p._id, nome: p.nome, metas: p.metas, fixo: false }))]
        .map(p => ({ ...p, descricao: descrever(p.metas) }));
}
async function obterPlanoAtendimento(id = PADRAO) {
    const fixo = PLANOS_ATENDIMENTO.find(p => p.id === id);
    if (fixo) return fixo;
    if (typeof id === 'string' && /^custom_[a-f0-9]{24}$/.test(id)) {
        const salvo = await Plano.findById(id).lean();
        if (salvo) return { id: salvo._id, nome: salvo.nome, metas: salvo.metas };
    }
    const erro = new Error('Selecione um plano de atendimento válido.'); erro.status = 400; throw erro;
}
module.exports = { PADRAO, PLANOS_ATENDIMENTO, descrever, listarPlanosAtendimento, obterPlanoAtendimento };
