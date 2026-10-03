const Participante = require('../models/ParticipanteGappus');
const Atendimento = require('../models/Atendimento');
const Assistido = require('../models/Assistido');
const op = require('../utils/operacao');

function identidade(p) { return p.participante_id || p.cpf; }
function idValido(id) { return typeof id === 'string' && /^(?:\d{11}|[a-f\d]{24})$/i.test(id); }
function desistiuNaData(p, data) { return p.status === 'Desistiu' && (!p.desistencia_em || op.dataISO(p.desistencia_em) <= data); }

async function carregarPessoas() {
    const [cadastros, encaminhamentos] = await Promise.all([
        Participante.find().lean(),
        Atendimento.find({ tipo: 'apometria' }).sort({ data: 1 }).lean()
    ]);
    const cpfs = [...new Set([...encaminhamentos.map(p => p.cpf_assistido), ...cadastros.map(p => p.cpf)].filter(Boolean))];
    const assistidos = await Assistido.find({ _id: { $in: cpfs } }).lean();
    const pessoas = new Map(assistidos.map(a => [a._id, { id: a._id, cpf: a._id, nome: a.nome_assistido, papel: 'Assistido' }]));
    for (const atendimento of encaminhamentos) {
        const atendido = pessoas.get(atendimento.cpf_assistido);
        if (atendido && atendimento.para_terceiro) pessoas.set(atendido.id, { ...atendido, papel: 'Atendido', vinculo_id: atendimento.beneficiario?.participante_id, vinculo_nome: atendimento.beneficiario?.nome });
        if (atendimento.beneficiario) {
            const b = atendimento.beneficiario;
            pessoas.set(b.participante_id, { ...pessoas.get(b.participante_id), id: b.participante_id, cpf: b.cpf, nome: b.nome, papel: 'Assistido' });
        }
    }
    for (const p of cadastros) pessoas.set(p._id, { ...pessoas.get(p._id), ...p, id: p._id });
    return { pessoas, encaminhamentos };
}

async function resolverPessoa(id) {
    if (!idValido(id)) return null;
    const { pessoas } = await carregarPessoas();
    if (pessoas.has(id)) return pessoas.get(id);
    if (/^\d{11}$/.test(id)) {
        const assistido = await Assistido.findById(id).lean();
        if (assistido) return { id, cpf: id, nome: assistido.nome_assistido, papel: 'Assistido' };
    }
    return null;
}

async function montarLista(data, encontro) {
    return montarListaComCadastro(data, encontro, await carregarPessoas());
}
function montarListaComCadastro(data, encontro, { pessoas, encaminhamentos }) {
    const indicados = new Set();
    const ultimos = new Map();
    for (const atendimento of encaminhamentos) {
        if (op.dataISO(atendimento.data) > data) continue;
        const anterior = ultimos.get(atendimento.cpf_assistido);
        if (!anterior || new Date(atendimento.data) >= new Date(anterior.data)) ultimos.set(atendimento.cpf_assistido, atendimento);
    }
    for (const atendimento of ultimos.values()) {
        if (!atendimento.gappus_indicado) continue;
        indicados.add(atendimento.cpf_assistido);
        if (atendimento.beneficiario) indicados.add(atendimento.beneficiario.participante_id);
    }
    for (const p of pessoas.values()) if (p.inclusao_manual && (!p.data_inicio || p.data_inicio <= data)) indicados.add(p.id);
    const presentes = new Map((encontro?.participantes || []).filter(p => identidade(p)).map(p => [identidade(p), p]));
    const ids = new Set([...indicados, ...presentes.keys()]);
    const participantes = [];
    for (const id of ids) {
        const p = pessoas.get(id) || { ...presentes.get(id), id, nome: presentes.get(id)?.nome || id, papel: presentes.get(id)?.papel || 'Assistido' };
        if (!p || (desistiuNaData(p, data) && !presentes.has(id))) continue;
        participantes.push({ ...p, presente: presentes.has(id), desistiu: desistiuNaData(p, op.hojeLocal()) });
    }
    const desistentes = [...pessoas.values()].filter(p => p.status === 'Desistiu');
    participantes.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    desistentes.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return { participantes, desistentes };
}
module.exports = { identidade, idValido, desistiuNaData, carregarPessoas, resolverPessoa, montarLista, montarListaComCadastro };
