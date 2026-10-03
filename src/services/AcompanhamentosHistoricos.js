// Identifica interrupções a partir do histórico de atendimentos e presenças.
const { dataISO } = require('../utils/operacao');

function datasPresencasGappus(encontros) {
    const ultimas = new Map();
    for (const encontro of encontros) {
        for (const p of encontro.participantes || []) {
            const cpf = String(p.cpf || '').replace(/\D/g, '');
            if (cpf.length !== 11) continue;
            if (!ultimas.has(cpf) || encontro._id > ultimas.get(cpf)) ultimas.set(cpf, encontro._id);
        }
    }
    return ultimas;
}
function identificarInterrompidos(registros, encontrosGappus = []) {
    const presencas = datasPresencasGappus(encontrosGappus);
    const porCpf = new Map();
    for (const registro of registros) {
        const cpf = String(registro._id || '').replace(/\D/g, '');
        if (cpf.length !== 11) continue;
        if (!porCpf.has(cpf)) porCpf.set(cpf, []);
        for (const atendimento of registro.atendimentos || []) {
            const data = new Date(atendimento.data);
            const tipo = String(atendimento.tipo || '').trim().toLowerCase();
            if (!atendimento.data || Number.isNaN(data.getTime()) || !tipo) continue;
            porCpf.get(cpf).push({ ...atendimento, data, tipo });
        }
    }
    const interrompidos = [];
    for (const [cpf, atendimentos] of porCpf) {
        atendimentos.sort((a, b) => a.data - b.data);
        const ultimaApometria = atendimentos.findLast(a => a.tipo === 'apometria');
        if (!ultimaApometria) continue;
        if (presencas.get(cpf) >= dataISO(ultimaApometria.data)) continue;
        const ciclo = atendimentos.filter(a => a.data >= ultimaApometria.data);
        if (!ciclo.some(a => a.tipo === 'passe') || ciclo.some(a => !['apometria', 'passe'].includes(a.tipo))) continue;
        const ultimo = ciclo[ciclo.length - 1];
        interrompidos.push({
            cpf_assistido: cpf, nome: ultimo.nome || ultimaApometria.nome || cpf,
            terapia: 'apometria', status: 'Interrompido', origemHistorico: true,
            ultimaData: ultimo.data, data_inicio: ultimaApometria.data,
            data_retorno: '', retornoVencido: false
        });
    }
    return interrompidos.sort((a, b) => a.ultimaData - b.ultimaData);
}
module.exports = { identificarInterrompidos, datasPresencasGappus };
