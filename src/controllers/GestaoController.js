const mongoose = require('mongoose');
const Assistido = require('../models/Assistido');
const Atendimento = require('../models/Atendimento');
const Voluntario = require('../models/Voluntario');
const Escala = require('../models/EscalaData');
const Fluxo = require('../models/ConfiguracaoFluxo');
const Limite = require('../models/LimiteAtendimento');
const EncontroGappus = require('../models/EncontroGappus');
const PlanoAtendimento = require('../models/PlanoAtendimento');
const { listarPlanosAtendimento } = require('../services/PlanosAtendimento');
const { listarConfiguracoes } = require('../services/ConfiguracaoOperacao');
const op = require('../utils/operacao');

function erro(mensagem, status = 400) { const e = new Error(mensagem); e.status = status; throw e; }
function idValido(id) { if (!mongoose.isObjectIdOrHexString(id)) erro('Registro inválido.'); }
function cpfValido(valor) {
    const cpf = op.texto(valor, 20).replace(/\D/g, '');
    if (cpf.length !== 11) erro('Informe um CPF com 11 dígitos.');
    return cpf;
}
function modalidadeValida(id, incluirApoio = false) {
    if (!op.MODALIDADES.some(m => m.id === id) && !(incluirApoio && ['cantina', 'mesa'].includes(id))) erro('Modalidade inválida.');
    return id;
}
function pagina(res, nome, dados) {
    return res.render(`gestao/${nome}`, { modalidades: op.MODALIDADES, formatarData: op.formatarData, dataNascimentoISO: op.dataNascimentoISO, hoje: op.hojeLocal(), ...dados });
}
function acao(fn) {
    return async (req, res) => {
        try { await fn(req, res); }
        catch (e) {
            const conhecido = e.status || e.code === 11000 || e.name === 'ValidationError';
            if (!conhecido) console.error('Erro na gestão:', e);
            pagina(res.status(e.status || (conhecido ? 400 : 500)), 'erro', {
                mensagem: e.code === 11000 ? 'Já existe um registro para essa combinação. Revise os dados.' : conhecido ? e.message : 'Não foi possível concluir a operação. Tente novamente.'
            });
        }
    };
}

exports.listarAssistidos = acao(async (req, res) => {
    const busca = op.texto(req.query.busca, 100);
    const status = op.texto(req.query.status, 20);
    const filtro = {};
    if (busca) {
        const regex = new RegExp(op.escapeRegex(busca), 'i');
        filtro.$or = [{ nome_assistido: regex }, { _id: regex }];
        const cpf = busca.replace(/\D/g, '');
        if (cpf) filtro.$or.push({ _id: new RegExp(op.escapeRegex(cpf)) });
    }
    if (['Ativo', 'Inativo'].includes(status)) filtro.status = status;
    const numeroPagina = req.query.pagina ? op.inteiro(req.query.pagina, 1, 100000) : 1;
    const [assistidos, total] = await Promise.all([
        Assistido.find(filtro).sort({ nome_assistido: 1, _id: 1 }).skip((numeroPagina - 1) * 30).limit(30).lean(),
        Assistido.countDocuments(filtro)
    ]);
    pagina(res, 'assistidos', { assistidos, total, busca, status, numeroPagina });
});

exports.fichaAssistido = acao(async (req, res) => {
    const cpf = cpfValido(req.params.cpf);
    const assistido = await Assistido.findById(cpf).lean();
    if (!assistido) erro('Assistido não encontrado.', 404);
    const [historico, encontrosGappus] = await Promise.all([
        Atendimento.find({ cpf_assistido: new RegExp(`^\\D*${cpf.split('').join('\\D*')}\\D*$`) }).sort({ data: -1 }).lean(),
        EncontroGappus.find({ 'participantes.cpf': cpf }).sort({ _id: -1 }).lean()
    ]);
    pagina(res, 'assistido', { assistido, historico, encontrosGappus, salvo: req.query.salvo === '1' });
});

exports.salvarAssistido = acao(async (req, res) => {
    const cpf = cpfValido(req.params.cpf);
    const b = req.body;
    const nome = op.texto(b.nome_assistido, 150);
    if (!nome) erro('Informe o nome do assistido.');
    if (!['Ativo', 'Inativo'].includes(b.status)) erro('Situação inválida.');
    const nascimento = op.texto(b.data_nascimento_assistido, 10);
    if (nascimento && (!op.dataValida(nascimento) || nascimento > op.hojeLocal())) erro('Data de nascimento inválida.');
    const email = op.texto(b.email_assistido, 200);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erro('E-mail inválido.');
    const uf = op.texto(b.uf_assistido, 2).toUpperCase();
    if (uf && !['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].includes(uf)) erro('UF inválida.');
    const atualizado = await Assistido.findByIdAndUpdate(cpf, { $set: {
        nome_assistido: nome, telefone_assistido: op.texto(b.telefone_assistido, 30),
        data_nascimento_assistido: nascimento ? op.inicioDia(nascimento) : null,
        sexo_assistido: op.texto(b.sexo_assistido, 50), religiao_assistido: op.texto(b.religiao_assistido, 100),
        cidade_assistido: op.texto(b.cidade_assistido, 100), uf_assistido: uf, email_assistido: email, status: b.status
    } }, { returnDocument: 'after', runValidators: true });
    if (!atualizado) erro('Assistido não encontrado.', 404);
    res.redirect(`/assistidos/${cpf}?salvo=1`);
});

exports.configuracoes = acao(async (req, res) => pagina(res, 'configuracoes', {
    configuracoes: await listarConfiguracoes(), planosAtendimento: await listarPlanosAtendimento(), dias: op.DIAS, salvo: req.query.salvo === '1'
}));
function dadosPlanoAtendimento(body) {
    const nome = op.texto(body.nome, 100);
    if (!nome) erro('Informe o nome do plano de atendimento.');
    const metas = ['apometria', 'passe', 'reiki', 'auriculo'].map(terapia => ({ terapia,
        sessoes_previstas: op.inteiro(body[`sessoes_${terapia}`] ?? '0', 0, 100) })).filter(m => m.sessoes_previstas > 0);
    if (!metas.length) erro('Informe pelo menos uma sessão em uma terapia.');
    return { nome, metas };
}
exports.criarPlanoAtendimento = acao(async (req, res) => {
    const dados = dadosPlanoAtendimento(req.body);
    await PlanoAtendimento.create({ _id: `custom_${new mongoose.Types.ObjectId()}`, ...dados });
    res.redirect('/configuracoes?salvo=1#planos-atendimento');
});
exports.salvarPlanoAtendimento = acao(async (req, res) => {
    const id = req.params.id;
    if (!/^custom_[a-f0-9]{24}$/.test(id)) erro('Plano de atendimento inválido.');
    const dados = dadosPlanoAtendimento(req.body);
    const salvo = await PlanoAtendimento.findByIdAndUpdate(id, { $set: dados }, { returnDocument: 'after', runValidators: true });
    if (!salvo) erro('Plano de atendimento não encontrado.', 404);
    res.redirect('/configuracoes?salvo=1#planos-atendimento');
});
exports.salvarConfiguracao = acao(async (req, res) => {
    const modalidade = modalidadeValida(req.params.terapia);
    const config = (await listarConfiguracoes()).find(c => c.id === modalidade);
    const b = req.body;
    if (config.grupo) {
        await mongoose.connection.db.collection('terapias').updateOne(config.terapiaId ? { _id: config.terapiaId } : { terapia: modalidade },
            { $set: { terapia: modalidade, nome: config.nome, slug: config.slug, ativa: b.ativa === 'on', ordem: op.MODALIDADES.findIndex(m => m.id === modalidade) } }, { upsert: true });
        return res.redirect('/configuracoes?salvo=1');
    }
    const limites = {}, limitesEspera = {};
    for (const dia of op.DIAS) {
        if (b[`limite_${dia}`] !== '' && b[`limite_${dia}`] !== undefined) limites[dia] = op.inteiro(b[`limite_${dia}`]);
        if (b[`espera_${dia}`] !== '' && b[`espera_${dia}`] !== undefined) limitesEspera[dia] = op.inteiro(b[`espera_${dia}`]);
    }
    const limitePrincipal = b.limite_principal === '' ? null : op.inteiro(b.limite_principal);
    const espera = op.inteiro(b.limite_espera);
    const intervalo = op.inteiro(b.intervalo_dias, 0, 3650);
    const intervaloSemRetorno = op.inteiro(b.intervalo_sem_retorno_dias, 0, 3650);
    if (b.geraPasseAoFinalizar === 'on' && modalidade !== 'passe' && !(await listarConfiguracoes()).find(c => c.id === 'passe').ativa) erro('Ative a modalidade Passe antes de habilitar esse encaminhamento.');
    const dadosTerapia = { terapia: modalidade, nome: config.nome, slug: config.slug, ativa: b.ativa === 'on', ordem: op.MODALIDADES.findIndex(m => m.id === modalidade) };
    await mongoose.connection.db.collection('terapias').updateOne(config.terapiaId ? { _id: config.terapiaId } : { terapia: modalidade }, { $set: dadosTerapia }, { upsert: true });
    await Limite.findOneAndUpdate({ tipo: modalidade }, { $set: { limite_principal: limitePrincipal, limite_espera: espera, limites, limites_espera: limitesEspera } }, { upsert: true, runValidators: true });
    await Fluxo.findOneAndUpdate({ terapia: modalidade }, { $set: {
        geraPasseAoFinalizar: modalidade !== 'passe' && b.geraPasseAoFinalizar === 'on',
        requerSolicitacaoPrevia: b.requerSolicitacaoPrevia === 'on', intervalo_dias: intervalo, intervalo_sem_retorno_dias: intervaloSemRetorno
    } }, { upsert: true, runValidators: true });
    res.redirect('/configuracoes?salvo=1');
});

const modalidadesEscala = [...op.MODALIDADES, { id: 'cantina', nome: 'Cantina', disponibilidade: 'cantina' }, { id: 'mesa', nome: 'Mesa', disponibilidade: 'mesa' }];
exports.escala = acao(async (req, res) => {
    const data = op.texto(req.query.data, 10) || op.hojeLocal();
    if (!op.dataValida(data)) erro('Data inválida.');
    const [registros, voluntarios] = await Promise.all([
        Escala.find({ data }).sort({ inicio: 1, modalidade: 1 }).lean(), Voluntario.find().sort({ nome: 1 }).lean()
    ]);
    const mapa = new Map(voluntarios.map(v => [v._id, v]));
    const dia = op.DIAS_ABREV[op.diaSemana(data)];
    pagina(res, 'escala', { data, registros, voluntarios, mapa, modalidadesEscala, dia, salvo: req.query.salvo === '1' });
});
exports.salvarEscala = acao(async (req, res) => {
    const b = req.body;
    let anterior = null;
    if (req.params.id) { idValido(req.params.id); anterior = await Escala.findById(req.params.id).lean(); if (!anterior) erro('Escala não encontrada.', 404); }
    const dados = {
        data: op.texto(b.data, 10), modalidade: modalidadeValida(b.modalidade, true),
        inicio: op.texto(b.inicio, 5), fim: op.texto(b.fim, 5), cpf_voluntario: op.texto(b.cpf_voluntario, 20),
        cpf_substituto: op.texto(b.cpf_substituto, 20), motivo_substituicao: op.texto(b.motivo_substituicao, 500),
        observacoes: op.texto(b.observacoes, 1000), status: b.status
    };
    if (!op.dataValida(dados.data)) erro('Data inválida.');
    if (!dados.cpf_voluntario) erro('Selecione o voluntário original.');
    const hora = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    if (!hora.test(dados.inicio) || !hora.test(dados.fim) || dados.inicio >= dados.fim) erro('Informe um horário final posterior ao inicial, no mesmo dia.');
    if (!['Confirmado', 'Ausente'].includes(dados.status)) erro('Situação inválida.');
    if (dados.cpf_substituto === dados.cpf_voluntario) erro('O substituto deve ser diferente do voluntário original.');
    if (dados.cpf_substituto && (!dados.motivo_substituicao || dados.status !== 'Confirmado')) erro('Informe o motivo da substituição e mantenha a escala confirmada.');
    for (const cpf of [dados.cpf_voluntario, dados.cpf_substituto].filter(Boolean)) {
        const v = await Voluntario.findById(cpf).lean();
        const jaVinculado = anterior && anterior.modalidade === dados.modalidade && [anterior.cpf_voluntario, anterior.cpf_substituto].includes(cpf);
        if (!v || (v.esta_ativo !== 'Sim' && !jaVinculado)) erro('Selecione um voluntário ativo cadastrado.');
        const mod = modalidadesEscala.find(m => m.id === dados.modalidade);
        if (!jaVinculado && !(v.disponibilidade?.[mod.disponibilidade]?.length > 0)) erro(`${v.nome} não possui disponibilidade cadastrada nessa modalidade.`);
    }
    const efetivo = dados.cpf_substituto || dados.cpf_voluntario;
    if (dados.status === 'Confirmado') {
        const candidatos = await Escala.find({ data: dados.data, status: 'Confirmado', inicio: { $lt: dados.fim }, fim: { $gt: dados.inicio }, ...(anterior ? { _id: { $ne: anterior._id } } : {}) }).lean();
        if (candidatos.some(e => (e.cpf_substituto || e.cpf_voluntario) === efetivo)) erro('Esse voluntário já está escalado em um horário sobreposto.');
    }
    const reservas = op.reservasEscala(dados);
    if (anterior) await Escala.findByIdAndUpdate(anterior._id, {
        $set: { ...dados, ...(reservas ? { reservas } : {}) }, ...(!reservas ? { $unset: { reservas: 1 } } : {})
    }, { runValidators: true });
    else await Escala.create({ ...dados, ...(reservas ? { reservas } : {}) });
    res.redirect(`/voluntarios/escala-data?data=${dados.data}&salvo=1`);
});
