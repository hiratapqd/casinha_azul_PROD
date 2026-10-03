const { montarListaComCadastro, desistiuNaData, identidade, idValido } = require('./ParticipantesGappus');
const { dataValida } = require('../utils/operacao');

function resumirFaltasGappus(encontros, cadastro, inicio, fim) {
    const pessoas = new Map(cadastro.pessoas);
    // Une presenças antigas identificadas pelo CPF ao cadastro atual, mantendo
    // pessoas sem CPF com seus próprios identificadores.
    const porCpf = new Map();
    for (const pessoa of pessoas.values()) {
        if (!pessoa.cpf) continue;
        const anterior = porCpf.get(pessoa.cpf);
        if (!anterior || pessoa.inclusao_manual || pessoa.status) porCpf.set(pessoa.cpf, pessoa.id);
    }
    const canonico = p => (p.cpf && porCpf.get(p.cpf)) || porCpf.get(p.id) || p.id;
    const primeiraPresenca = new Map();
    // Participantes antigos podem existir somente nas listas de presença,
    // sem inclusão manual ou indicação na apometria daquela época.
    for (const encontro of encontros) {
        if (!dataValida(encontro._id) || encontro._id > fim) continue;
        for (const salvo of encontro.participantes || []) {
            const id = canonico({ ...salvo, id: identidade(salvo) });
            if (!idValido(id)) continue;
            if (!pessoas.has(id)) pessoas.set(id, { ...salvo, id, nome: salvo.nome || id, papel: salvo.papel || 'Assistido' });
            if (!primeiraPresenca.has(id) || encontro._id < primeiraPresenca.get(id)) primeiraPresenca.set(id, encontro._id);
        }
    }
    const cadastroHistorico = { ...cadastro, pessoas };
    const porPessoa = new Map();
    const realizados = encontros.filter(e => dataValida(e._id) && e._id >= inicio && e._id <= fim).sort((a, b) => a._id.localeCompare(b._id));
    for (const encontro of realizados) {
        const { participantes } = montarListaComCadastro(encontro._id, encontro, cadastroHistorico);
        const presentes = new Set((encontro.participantes || []).map(p => canonico({ ...p, id: identidade(p) })));
        for (const [id, inicioParticipacao] of primeiraPresenca) {
            if (inicioParticipacao > encontro._id) continue;
            const pessoa = pessoas.get(id);
            if (desistiuNaData(pessoa, encontro._id) && !presentes.has(id)) continue;
            participantes.push({ ...pessoa, presente: presentes.has(id) });
        }
        const nestaData = new Map();
        for (const p of participantes) {
            const id = canonico(p);
            const pessoa = pessoas.get(id) || p;
            if (!p.presente && desistiuNaData(pessoa, encontro._id)) continue;
            // Uma retomada redefine a data de início; não atribui faltas ao
            // participante no período anterior ao retorno ao grupo.
            if (!p.presente && pessoa.inclusao_manual && pessoa.data_inicio > encontro._id) continue;
            const anterior = nestaData.get(id);
            nestaData.set(id, { ...pessoa, presente: p.presente || anterior?.presente || false });
        }
        for (const [id, pessoa] of nestaData) {
            if (!porPessoa.has(id)) porPessoa.set(id, { id, nome: pessoa.nome, cpf: pessoa.cpf, papel: pessoa.papel,
                status: pessoa.status || 'Ativo', datasFaltas: [], presencas: 0, encontrosPrevistos: 0 });
            const resumo = porPessoa.get(id);
            resumo.encontrosPrevistos++;
            if (pessoa.presente) resumo.presencas++;
            else resumo.datasFaltas.push(encontro._id);
        }
    }
    const faltantes = [...porPessoa.values()].filter(p => p.datasFaltas.length)
        .sort((a, b) => b.datasFaltas.length - a.datasFaltas.length || a.nome.localeCompare(b.nome, 'pt-BR'));
    return { encontrosRealizados: realizados.length, faltantes };
}
module.exports = { resumirFaltasGappus };
