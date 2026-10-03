const Encontro = require('../models/EncontroGappus');
const Assistido = require('../models/Assistido');
const Voluntario = require('../models/Voluntario');
const Participante = require('../models/ParticipanteGappus');
const mongoose = require('mongoose');
const { identidade, idValido, desistiuNaData, carregarPessoas, resolverPessoa, montarLista } = require('../services/ParticipantesGappus');
const { listarConfiguracoes } = require('../services/ConfiguracaoOperacao');
const op = require('../utils/operacao');

function erro(mensagem, status = 400) { throw Object.assign(new Error(mensagem), { status }); }
function dataEncontro(valor) {
    const data = op.texto(valor, 10) || op.hojeLocal();
    if (!op.dataValida(data)) erro('Informe uma data válida para o encontro.');
    return data;
}
function acao(fn) {
    return async (req, res) => {
        try { await fn(req, res); }
        catch (e) {
            if (!e.status && e.code !== 11000) console.error('Erro no GAPPUS:', e);
            const mensagem = e.code === 11000 ? 'Já existe um cadastro ou uma atualização para esse registro. Reabra a tela antes de continuar.' : e.status ? e.message : 'Não foi possível concluir a operação. Tente novamente.';
            const resposta = res.status(e.code === 11000 ? 409 : e.status || 500);
            if (req.headers?.accept?.includes('application/json') || req.path?.startsWith('/api/')) resposta.json({ mensagem });
            else resposta.render('gestao/erro', { mensagem });
        }
    };
}

exports.formulario = acao(async (req, res) => {
    const data = dataEncontro(req.query.data);
    const [encontro, voluntarios, encontros, configs] = await Promise.all([
        Encontro.findById(data).lean(),
        Voluntario.find({ esta_ativo: 'Sim', 'disponibilidade.gappus.0': { $exists: true } }).sort({ nome: 1 }).lean(),
        Encontro.find().sort({ _id: -1 }).limit(30).lean(),
        listarConfiguracoes()
    ]);
    const { participantes, desistentes } = await montarLista(data, encontro);
    if (encontro && !voluntarios.some(v => v._id === encontro.responsavel_cpf)) {
        voluntarios.push({ _id: encontro.responsavel_cpf, nome: encontro.responsavel_nome });
    }
    res.render('gestao/gappus', { data, encontro, encontros, voluntarios, participantes, desistentes,
        ativa: configs.find(c => c.id === 'gappus')?.ativa, salvo: req.query.salvo === '1', formatarData: op.formatarData });
});

exports.salvar = acao(async (req, res) => {
    if (!req.body.data) erro('Informe a data do encontro.');
    const data = dataEncontro(req.body.data);
    if (data > op.hojeLocal()) erro('A presença só pode ser registrada em encontros de hoje ou de datas anteriores.');
    const versao = op.inteiro(req.body.versao, 0, 1000000);
    const cpfResponsavel = op.texto(req.body.responsavel_cpf, 20).replace(/\D/g, '');
    if (cpfResponsavel.length !== 11) erro('Selecione o responsável pelo encontro.');
    const [voluntario, existente, configs] = await Promise.all([
        Voluntario.findById(cpfResponsavel).lean(), Encontro.findById(data).lean(), listarConfiguracoes()
    ]);
    if (!configs.find(c => c.id === 'gappus')?.ativa && !existente) erro('Ative o GAPPUS nas configurações antes de registrar um encontro.');
    const responsavelAnterior = existente?.responsavel_cpf === cpfResponsavel;
    if (!responsavelAnterior && (!voluntario || voluntario.esta_ativo !== 'Sim' || !voluntario.disponibilidade?.gappus?.length)) {
        erro('Selecione um voluntário ativo com disponibilidade cadastrada no GAPPUS.');
    }
    const enviados = req.body.participantes === undefined ? [] : Array.isArray(req.body.participantes) ? req.body.participantes : [req.body.participantes];
    if (enviados.length > 1000) erro('A lista permite até 1000 participantes por encontro.');
    const ids = [...new Set(enviados.map(valor => {
        const id = op.texto(valor, 24);
        if (!idValido(id)) erro('Há um participante inválido na lista de presença.');
        return id;
    }))];
    const { pessoas } = await carregarPessoas();
    const assistidos = await Assistido.find({ _id: { $in: ids.filter(id => /^\d{11}$/.test(id)) } }).lean();
    for (const a of assistidos) if (!pessoas.has(a._id)) pessoas.set(a._id, { id: a._id, cpf: a._id, nome: a.nome_assistido, papel: 'Assistido' });
    const anteriores = new Map((existente?.participantes || []).map(p => [identidade(p), p]));
    const presencas = ids.map(id => {
        const p = pessoas.get(id) || anteriores.get(id);
        if (!p) erro('Participante não encontrado. Adicione ou selecione uma pessoa cadastrada antes de salvar.');
        if (desistiuNaData(p, data) && !anteriores.has(id)) erro(`${p.nome} desistiu do acompanhamento. Retome sua participação antes de registrar uma nova presença.`, 409);
        return { participante_id: id, ...(p.cpf ? { cpf: p.cpf } : {}), nome: p.nome, papel: p.papel || 'Assistido',
            ...(p.vinculo_id ? { vinculo_id: p.vinculo_id } : {}), ...(p.vinculo_nome ? { vinculo_nome: p.vinculo_nome } : {}) };
    });
    const gravado = await Encontro.findOneAndUpdate({ _id: data, versao }, {
        $set: { responsavel_cpf: cpfResponsavel, responsavel_nome: voluntario?.nome || existente.responsavel_nome,
            participantes: presencas, observacoes: op.texto(req.body.observacoes, 4000) },
        $inc: { versao: 1 }
    }, { upsert: versao === 0, returnDocument: 'after', runValidators: true });
    if (!gravado) erro('Esta lista foi atualizada em outra tela. Reabra o encontro antes de salvar.', 409);
    res.redirect(`/atendimento/gappus?data=${data}&salvo=1`);
});

exports.buscarParticipantes = acao(async (req, res) => {
    const busca = op.texto(req.query.busca, 150);
    if (busca.length < 2) return res.json([]);
    const { pessoas } = await carregarPessoas();
    const regex = new RegExp(op.escapeRegex(busca), 'i');
    const cpfBusca = busca.replace(/\D/g, '');
    const filtros = [{ nome_assistido: regex }];
    if (cpfBusca.length) filtros.push({ _id: new RegExp(op.escapeRegex(cpfBusca)) });
    const assistidos = await Assistido.find({ $or: filtros }).sort({ nome_assistido: 1 }).limit(30).lean();
    for (const a of assistidos) if (!pessoas.has(a._id)) pessoas.set(a._id, { id: a._id, nome: a.nome_assistido, cpf: a._id, papel: 'Assistido' });
    res.json([...pessoas.values()].filter(p => regex.test(p.nome) || (cpfBusca && p.cpf?.includes(cpfBusca)))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).slice(0, 30).map(p => ({ id: p.id, nome: p.nome, cpf: p.cpf, papel: p.papel, status: p.status || 'Ativo', vinculo_nome: p.vinculo_nome })));
});

exports.adicionarParticipante = acao(async (req, res) => {
    const nome = op.texto(req.body.nome, 150);
    const cpf = op.texto(req.body.cpf, 20).replace(/\D/g, '');
    if (!nome || (cpf && cpf.length !== 11)) erro('Informe o nome e, se disponível, um CPF com 11 dígitos.');
    const papel = op.texto(req.body.papel, 20) || 'Familiar';
    if (!['Atendido', 'Assistido', 'Familiar'].includes(papel)) erro('Tipo de participante inválido.');
    const inicio = dataEncontro(req.body.data);
    if (inicio > op.hojeLocal()) erro('A inclusão no grupo deve ser hoje ou em uma data anterior.');
    if (!(await listarConfiguracoes()).find(c => c.id === 'gappus')?.ativa) erro('Ative o GAPPUS antes de incluir novos participantes.');
    const pessoa = cpf ? await resolverPessoa(cpf) : null;
    if (pessoa?.status === 'Desistiu') erro('Esta pessoa desistiu do acompanhamento. Use Retomar acompanhamento para incluí-la novamente.', 409);
    const id = pessoa?.id || cpf || new mongoose.Types.ObjectId().toString();
    const registro = await Participante.findOneAndUpdate({ _id: id }, { $set: {
        nome: pessoa?.nome || nome, ...(cpf ? { cpf } : {}), papel,
        vinculo_nome: op.texto(req.body.vinculo_nome, 150) || pessoa?.vinculo_nome,
        inclusao_manual: true, data_inicio: pessoa?.data_inicio || inicio
    } }, { upsert: true, returnDocument: 'after', runValidators: true });
    res.json({ id: registro._id, nome: registro.nome, cpf: registro.cpf, papel: registro.papel, vinculo_nome: registro.vinculo_nome });
});

exports.incluirExistente = acao(async (req, res) => {
    const pessoa = await resolverPessoa(req.params.id);
    if (!pessoa) erro('Participante não encontrado.', 404);
    if (pessoa.status === 'Desistiu') erro('Esta pessoa desistiu do acompanhamento. Use Retomar acompanhamento antes de incluí-la novamente.', 409);
    const inicio = dataEncontro(req.body.data);
    if (inicio > op.hojeLocal()) erro('A inclusão no grupo deve ser hoje ou em uma data anterior.');
    if (!(await listarConfiguracoes()).find(c => c.id === 'gappus')?.ativa) erro('Ative o GAPPUS antes de incluir novos participantes.');
    await Participante.findOneAndUpdate({ _id: pessoa.id }, { $set: {
        nome: pessoa.nome, ...(pessoa.cpf ? { cpf: pessoa.cpf } : {}), papel: pessoa.papel || 'Assistido',
        vinculo_nome: pessoa.vinculo_nome, vinculo_id: pessoa.vinculo_id,
        inclusao_manual: true, data_inicio: pessoa.data_inicio || inicio
    } }, { upsert: true, returnDocument: 'after', runValidators: true });
    res.json(pessoa);
});

exports.desistir = acao(async (req, res) => {
    const pessoa = await resolverPessoa(req.params.id);
    if (!pessoa) erro('Participante não encontrado.', 404);
    // A desistência vale para o grupo e preserva o histórico de presenças.
    const alterado = await Participante.findOneAndUpdate({ _id: pessoa.id, status: { $ne: 'Desistiu' } }, { $set: {
        nome: pessoa.nome, ...(pessoa.cpf ? { cpf: pessoa.cpf } : {}), papel: pessoa.papel || 'Assistido',
        vinculo_nome: pessoa.vinculo_nome, vinculo_id: pessoa.vinculo_id,
        status: 'Desistiu', desistencia_em: new Date()
    } }, { upsert: pessoa.status !== 'Desistiu', returnDocument: 'after', runValidators: true });
    res.json({ status: 'Desistiu', desistencia_em: alterado?.desistencia_em || pessoa.desistencia_em });
});

exports.retomar = acao(async (req, res) => {
    const pessoa = await resolverPessoa(req.params.id);
    if (!pessoa) erro('Participante não encontrado.', 404);
    await Participante.findOneAndUpdate({ _id: pessoa.id }, { $set: { status: 'Ativo', inclusao_manual: true, data_inicio: op.hojeLocal() }, $unset: { desistencia_em: 1 } }, { returnDocument: 'after' });
    res.json({ ...pessoa, status: 'Ativo' });
});

exports.presencasParticipante = acao(async (req, res) => {
    const pessoa = await resolverPessoa(req.params.id);
    if (!pessoa) erro('Participante não encontrado.', 404);
    const filtros = [{ 'participantes.participante_id': pessoa.id }];
    if (pessoa.cpf) filtros.push({ 'participantes.cpf': pessoa.cpf });
    const encontros = await Encontro.find({ $or: filtros }).sort({ _id: -1 }).lean();
    res.render('gestao/gappus_participante', { pessoa, encontros, formatarData: op.formatarData });
});
