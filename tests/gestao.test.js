const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ejs = require('ejs');
const mongoose = require('mongoose');
const op = require('../src/utils/operacao');
const Assistido = require('../src/models/Assistido');
const Atendimento = require('../src/models/Atendimento');
const Voluntario = require('../src/models/Voluntario');
const EncontroGappus = require('../src/models/EncontroGappus');
const ParticipanteGappus = require('../src/models/ParticipanteGappus');
const Escala = require('../src/models/EscalaData');
const Fluxo = require('../src/models/ConfiguracaoFluxo');
const Limite = require('../src/models/LimiteAtendimento');
const Solicitacao = require('../src/models/Solicitacao');
const gestao = require('../src/controllers/GestaoController');
const recepcao = require('../src/controllers/RecepcaoController');
const solicitacoes = require('../src/controllers/SolicitacaoController');
const atendimento = require('../src/controllers/AtendimentoController');
const { listarConfiguracoes } = require('../src/services/ConfiguracaoOperacao');
const { identificarInterrompidos } = require('../src/services/AcompanhamentosHistoricos');
const cpf = '12345678906';
const id = '507f1f77bcf86cd799439011';
function consulta(dados) {
    return { sort() { return this; }, skip() { return this; }, limit() { return this; }, lean: async () => dados };
}
test.beforeEach(t => {
    t.mock.method(require('../src/models/PlanoAtendimento'), 'find', () => consulta([]));
    t.mock.method(ParticipanteGappus, 'find', () => consulta([]));
    t.mock.method(EncontroGappus, 'find', () => consulta([]));
    t.mock.method(EncontroGappus, 'findById', () => consulta(null));
});
function resposta() {
    return { codigo: 200, status(c) { this.codigo = c; return this; },
        render(tela, dados) { this.tela = tela; this.dados = dados; },
        redirect(url) { this.url = url; }, json(dados) { this.dados = dados; } };
}
function configMock(t, terapias = [], fluxos = [], limites = []) {
    const anterior = mongoose.connection.db;
    mongoose.connection.db = { collection: () => ({ find: () => ({ toArray: async () => terapias }) }) };
    t.after(() => { mongoose.connection.db = anterior; });
    t.mock.method(Fluxo, 'find', () => consulta(fluxos));
    t.mock.method(Limite, 'find', () => consulta(limites));
}

test('datas inválidas, limites negativos e entradas não textuais são rejeitados', () => {
    assert.equal(op.dataValida('2026-02-30'), false);
    assert.equal(op.dataValida('2024-02-29'), true);
    assert.equal(op.inicioDia('2026-10-02').toISOString(), '2026-10-02T03:00:00.000Z');
    assert.throws(() => op.inteiro('-1'), { status: 400 });
    assert.throws(() => op.inteiro('1.5'), { status: 400 });
    assert.throws(() => op.texto({ $ne: '' }), { status: 400 });
});
test('histórico de apometria e passe identifica interrupção mesmo sem plano cadastrado', () => {
    const registros = [{ _id: cpf, atendimentos: [
        { tipo: 'passe', data: '2026-09-01T13:00:00Z', nome: 'Assistido' },
        { tipo: ' Apometria ', data: '2026-09-01T12:00:00Z' }
    ] }];
    const lista = identificarInterrompidos(registros);
    assert.equal(lista.length, 1); assert.equal(lista[0].status, 'Interrompido');
    assert.equal(lista[0].cpf_assistido, cpf); assert.equal(lista[0].origemHistorico, true);
    assert.equal(lista[0].nome, 'Assistido');
});
test('retorno em outra modalidade elimina interrupção histórica', () => {
    const registros = [{ _id: cpf, atendimentos: [
        { tipo: 'apometria', data: '2026-09-01T12:00:00Z' },
        { tipo: 'passe', data: '2026-09-01T13:00:00Z' },
        { tipo: 'Reiki', data: '2026-09-15T12:00:00Z' }
    ] }];
    assert.equal(identificarInterrompidos(registros).length, 0);
});
test('interrupção considera só o último ciclo e reúne CPF com e sem máscara', () => {
    const registros = [{ _id: cpf, atendimentos: [
        { tipo: 'apometria', data: '2026-08-01T12:00:00Z' },
        { tipo: 'passe', data: '2026-08-01T13:00:00Z' },
        { tipo: 'reiki', data: '2026-08-15T12:00:00Z' },
        { tipo: 'apometria', data: '2026-09-01T12:00:00Z' }
    ] }, { _id: '123.456.789-06', atendimentos: [
        { tipo: 'passe', data: '2026-09-01T13:00:00Z' }
    ] }];
    assert.equal(identificarInterrompidos(registros).length, 1);
    registros[0].atendimentos.push({ tipo: 'apometria', data: '2026-10-01T12:00:00Z' });
    assert.equal(identificarInterrompidos(registros).length, 0, 'Passe de um ciclo anterior não conta para o ciclo atual');
});
test('datas inválidas e históricos sem apometria ou sem passe não geram interrupção', () => {
    assert.deepEqual(identificarInterrompidos([
        { _id: cpf, atendimentos: [{ tipo: 'apometria', data: 'inválida' }, { tipo: 'passe', data: '2026-09-01' }] },
        { _id: '12345678907', atendimentos: [{ tipo: 'apometria', data: '2026-09-01' }] }
    ]), []);
});
test('reservas da escala detectam sobreposição e liberam horários do substituído', () => {
    const escala = { data: '2026-10-02', inicio: '09:00', fim: '10:00', cpf_voluntario: cpf, status: 'Confirmado' };
    const reservas = op.reservasEscala(escala);
    assert.equal(reservas.length, 60);
    const adjacentes = op.reservasEscala({ ...escala, inicio: '10:00', fim: '11:00' });
    assert.equal(adjacentes.some(r => reservas.includes(r)), false);
    assert.equal(op.reservasEscala({ ...escala, inicio: '09:30', fim: '10:30' }).filter(r => reservas.includes(r)).length, 30);
    assert.equal(op.reservasEscala({ ...escala, status: 'Ausente' }), undefined);
    assert.ok(op.reservasEscala({ ...escala, cpf_substituto: '12345678907' }).every(r => r.includes('_12345678907_')));
});
test('configurações preservam zero, desativação e as rotas existentes', async t => {
    configMock(t, [{ terapia: 'apometria', slug: 'apometria', ativa: false }], [], [{ tipo: 'reiki', limite_principal: 0, limites: { sexta: 0 } }]);
    const configs = await listarConfiguracoes();
    assert.equal(configs.find(c => c.id === 'apometria').ativa, false);
    assert.equal(configs.find(c => c.id === 'apometria').slug, 'apometrico');
    assert.equal(configs.find(c => c.id === 'homeopatia').slug, 'homeopatico');
    assert.equal(configs.find(c => c.id === 'reiki').limite_principal, 0);
});
test('configuração salva limite zero, padrão ilimitado e encaminhamento sem criar rotas inexistentes', async t => {
    configMock(t);
    let terapia, limite, fluxo;
    mongoose.connection.db.collection = () => ({ find: () => ({ toArray: async () => [] }), updateOne: async (filtro, update) => { terapia = update.$set; } });
    t.mock.method(Limite, 'findOneAndUpdate', async (filtro, update) => { limite = update.$set; });
    t.mock.method(Fluxo, 'findOneAndUpdate', async (filtro, update) => { fluxo = update.$set; });
    const res = resposta();
    await gestao.salvarConfiguracao({ params: { terapia: 'apometria' }, body: { ativa: 'on', geraPasseAoFinalizar: 'on', requerSolicitacaoPrevia: 'on', limite_principal: '', limite_espera: '2', limite_sexta: '0', intervalo_dias: '28', intervalo_sem_retorno_dias: '90' } }, res);
    assert.equal(res.url, '/configuracoes?salvo=1'); assert.equal(terapia.slug, 'apometrico');
    assert.equal(limite.limite_principal, null); assert.equal(limite.limites.sexta, 0);
    assert.equal(fluxo.intervalo_dias, 28); assert.equal(fluxo.geraPasseAoFinalizar, true);
});
test('entrada inválida nas configurações não grava parcialmente', async t => {
    configMock(t);
    let gravacoes = 0;
    mongoose.connection.db.collection = () => ({ find: () => ({ toArray: async () => [] }), updateOne: async () => { gravacoes++; } });
    const res = resposta();
    await gestao.salvarConfiguracao({ params: { terapia: 'reiki' }, body: { limite_principal: '5', limite_espera: '0', intervalo_dias: '-1', intervalo_sem_retorno_dias: '90' } }, res);
    assert.equal(res.codigo, 400); assert.equal(gravacoes, 0);
});




test('configuração persiste espera por dia incluindo zero e remove substituições deixadas em branco', async t => {
    configMock(t);
    mongoose.connection.db.collection = () => ({ find: () => ({ toArray: async () => [] }), updateOne: async () => {} });
    let limite;
    t.mock.method(Limite, 'findOneAndUpdate', async (filtro, update) => { limite = update.$set; });
    t.mock.method(Fluxo, 'findOneAndUpdate', async () => {});
    const res = resposta();
    await gestao.salvarConfiguracao({ params: { terapia: 'reiki' }, body: {
        limite_principal: '5', limite_espera: '2', espera_sexta: '0', espera_sabado: '4', espera_domingo: '',
        intervalo_dias: '27', intervalo_sem_retorno_dias: '90'
    } }, res);
    assert.ok(res.url); assert.deepEqual(limite.limites_espera, { sexta: 0, sabado: 4 });
});

test('recepção usa espera do dia, incluindo zero, e recorre ao padrão nos outros dias', async t => {
    const dia = op.DIAS[op.diaSemana(op.hojeLocal())];
    let capacidade = { tipo: 'reiki', limite_principal: 1, limite_espera: 2, limites_espera: { [dia]: 0 } };
    configMock(t);
    t.mock.method(Limite, 'find', () => consulta([capacidade]));
    t.mock.method(Assistido, 'findById', () => consulta({ _id: cpf, nome_assistido: 'Assistido' }));
    t.mock.method(Solicitacao, 'exists', async () => false);
    let total = 1, gravado;
    t.mock.method(Solicitacao, 'countDocuments', async () => total);
    t.mock.method(Solicitacao, 'findOneAndUpdate', async (filtro, update) => { gravado = update.$setOnInsert; });
    const fechado = resposta(); await recepcao.realizarCheckin({ body: { cpf, terapias: ['reiki'] } }, fechado);
    assert.equal(fechado.codigo, 400);
    capacidade.limites_espera[dia] = 1;
    const espera = resposta(); await recepcao.realizarCheckin({ body: { cpf, terapias: ['reiki'] } }, espera);
    assert.equal(espera.codigo, 200); assert.equal(gravado.status, 'Espera');
    total = 2;
    const cheio = resposta(); await recepcao.realizarCheckin({ body: { cpf, terapias: ['reiki'] } }, cheio);
    assert.equal(cheio.codigo, 400);
    capacidade.limites_espera = {};
    const padrao = resposta(); await recepcao.realizarCheckin({ body: { cpf, terapias: ['reiki'] } }, padrao);
    assert.equal(padrao.codigo, 200);
});

test('solicitação de apometria respeita espera no dia escolhido, além da recepção', async t => {
    const dia = op.DIAS[op.diaSemana('2026-10-02')];
    const capacidade = { tipo: 'apometria', limite_principal: 1, limite_espera: 5, limites_espera: { [dia]: 0 } };
    configMock(t, [], [], [capacidade]);
    t.mock.method(Solicitacao, 'exists', async () => false);
    t.mock.method(Solicitacao, 'countDocuments', async () => 1);
    t.mock.method(Atendimento, 'findOne', () => consulta(null));
    t.mock.method(Assistido, 'findByIdAndUpdate', async () => {});
    let gravado;
    t.mock.method(Solicitacao.prototype, 'save', async function () { gravado = this; });
    const req = { body: { cpf_assistido: cpf, nome: 'Assistido', data: '2026-10-02' } };
    const fechado = resposta(); await solicitacoes.criarSolicitacaoComCadastro(req, fechado);
    assert.equal(fechado.dados.status, 'limite_excedido'); assert.equal(gravado, undefined);
    capacidade.limites_espera[dia] = 1;
    const espera = resposta(); await solicitacoes.criarSolicitacaoComCadastro(req, espera);
    assert.equal(espera.dados.status, 'sucesso'); assert.equal(gravado.status, 'Espera');
});
test('edição do assistido preserva CPF e não modifica os atendimentos históricos', async t => {
    let chamada;
    t.mock.method(Assistido, 'findByIdAndUpdate', async (...args) => { chamada = args; return { _id: cpf }; });
    const res = resposta();
    await gestao.salvarAssistido({ params: { cpf }, body: { nome_assistido: 'Nome corrigido', status: 'Inativo', uf_assistido: 'sp', data_nascimento_assistido: '2000-01-01' } }, res);
    assert.equal(res.url, `/assistidos/${cpf}?salvo=1`);
    assert.equal(chamada[0], cpf); assert.equal(chamada[1].$set.uf_assistido, 'SP');
    assert.equal(chamada[1].$set.status, 'Inativo'); assert.equal(chamada[1].$set._id, undefined);
});
test('substituição preserva o original e grava reservas para o substituto', async t => {
    let gravado;
    const original = { _id: id, modalidade: 'reiki', cpf_voluntario: cpf, status: 'Confirmado' };
    t.mock.method(Escala, 'findById', () => consulta(original));
    t.mock.method(Voluntario, 'findById', cpfV => consulta({ _id: cpfV, nome: 'Voluntário', esta_ativo: 'Sim', disponibilidade: { reiki: ['sex'] } }));
    t.mock.method(Escala, 'find', () => consulta([]));
    t.mock.method(Escala, 'findByIdAndUpdate', async (escalaId, dados) => { gravado = dados.$set; });
    const res = resposta();
    await gestao.salvarEscala({ params: { id }, body: { data: '2026-10-02', modalidade: 'reiki', inicio: '09:00', fim: '10:00', cpf_voluntario: cpf, cpf_substituto: '12345678907', motivo_substituicao: 'Indisponibilidade', status: 'Confirmado' } }, res);
    assert.equal(res.codigo, 200); assert.equal(gravado.cpf_voluntario, cpf); assert.equal(gravado.cpf_substituto, '12345678907');
    assert.equal(gravado.reservas.length, 60); assert.ok(res.url.includes('data=2026-10-02'));
});
test('horário sobreposto é bloqueado mesmo em outra modalidade', async t => {
    t.mock.method(Voluntario, 'findById', () => consulta({ nome: 'Voluntário', esta_ativo: 'Sim', disponibilidade: { reiki: ['sex'] } }));
    t.mock.method(Escala, 'find', () => consulta([{ cpf_voluntario: cpf, modalidade: 'passe' }]));
    const criar = t.mock.method(Escala, 'create', async () => {});
    const res = resposta();
    await gestao.salvarEscala({ params: {}, body: { data: '2026-10-02', modalidade: 'reiki', inicio: '09:00', fim: '10:00', cpf_voluntario: cpf, status: 'Confirmado' } }, res);
    assert.equal(res.codigo, 400); assert.match(res.dados.mensagem, /sobreposto/); assert.equal(criar.mock.callCount(), 0);
});
test('check-in repetido não altera o status ou relato existentes', async t => {
    configMock(t);
    t.mock.method(Assistido, 'findById', () => consulta({ _id: cpf, nome_assistido: 'Assistido' }));
    t.mock.method(Solicitacao, 'exists', async () => true);
    let update;
    t.mock.method(Solicitacao, 'findOneAndUpdate', async (filtro, dados) => { update = dados; });
    const res = resposta();
    await recepcao.realizarCheckin({ body: { cpf, terapias: ['reiki'], queixa: 'Relato' } }, res);
    assert.equal(res.codigo, 200); assert.equal(update.$set, undefined); assert.equal(update.$setOnInsert.status, 'Aguardando');
});
test('recepção respeita modalidade inativa e dia com zero vagas', async t => {
    configMock(t, [{ terapia: 'passe', ativa: false }], [], [{ tipo: 'reiki', limite_principal: 0 }]);
    t.mock.method(Assistido, 'findById', () => consulta({ _id: cpf, nome_assistido: 'Assistido' }));
    t.mock.method(Solicitacao, 'exists', async () => false);
    t.mock.method(Solicitacao, 'countDocuments', async () => 0);
    for (const terapia of ['passe', 'reiki']) {
        const res = resposta(); await recepcao.realizarCheckin({ body: { cpf, terapias: [terapia] } }, res);
        assert.equal(res.codigo, 400);
    }
});
test('atendimento exige solicitação quando a configuração está habilitada', async t => {
    configMock(t, [], [{ terapia: 'reiki', requerSolicitacaoPrevia: true }]);
    t.mock.method(Solicitacao, 'findOne', () => consulta(null));
    const res = resposta(); await atendimento.salvarAtendimento({ body: { cpf_assistido: cpf, tipo: 'reiki' } }, res);
    assert.equal(res.codigo, 400); assert.match(res.dados.mensagem, /check-in/);
});
test('rotas novas respondem por HTTP com as telas corretas, sem conexão de produção', async t => {
    const express = require('express');
    configMock(t);
    t.mock.method(Assistido, 'find', () => consulta([]));
    t.mock.method(Assistido, 'findById', () => consulta({ _id: cpf, nome_assistido: 'Assistido', status: 'Ativo' }));
    t.mock.method(Assistido, 'countDocuments', async () => 0);
    t.mock.method(Atendimento, 'find', () => consulta([]));
    const filtrosVoluntarios = [];
    t.mock.method(Voluntario, 'find', filtro => {
        filtrosVoluntarios.push(filtro);
        return consulta(filtro?.esta_ativo ? [{ nome: 'Terapeuta <Teste>' }] : []);
    });
    t.mock.method(Escala, 'find', () => consulta([]));
    const app = express();
    app.set('view engine', 'ejs'); app.set('views', path.join(__dirname, '..', 'views')); app.locals.terapias = op.MODALIDADES;
    app.use(express.urlencoded({ extended: true })); app.use(require('../src/routes/indexRoutes'));
    const server = await new Promise(resolve => { const instancia = app.listen(0, '127.0.0.1', () => resolve(instancia)); });
    t.after(() => { server.closeAllConnections(); server.close(); });
    const origem = `http://127.0.0.1:${server.address().port}`;
    for (const [url, titulo] of [ ['/assistidos', 'Consulta de assistidos'], [`/assistidos/${cpf}`, 'Ficha do assistido'], ['/configuracoes', 'Configurações da operação'], ['/voluntarios/escala-data?data=2026-10-02', 'Escala por data e substituições'] ]) {
        const res = await fetch(origem + url); assert.equal(res.status, 200, url); assert.ok((await res.text()).includes(titulo), url);
    }
    for (const url of ['/acompanhamentos', '/acompanhamentos/novo', '/acompanhamentos/' + id + '/editar']) {
        assert.equal((await fetch(origem + url)).status, 404);
    }
    assert.equal((await fetch(origem + '/configuracoes/planos', { method: 'POST' })).status, 400);
    for (const modalidade of op.MODALIDADES.filter(m => !m.grupo)) {
        const res = await fetch(origem + '/atendimento/' + modalidade.slug);
        assert.equal(res.status, 200, modalidade.id);
        const html = await res.text();
        for (const bloco of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new Function(bloco[1]);
        assert.match(html, /<select name="voluntario" id="voluntario" required>/);
        assert.ok(html.includes('value="Terapeuta &lt;Teste&gt;"'));
        assert.deepEqual(filtrosVoluntarios.at(-1), {
            esta_ativo: 'Sim', [`disponibilidade.${modalidade.disponibilidade}.0`]: { $exists: true }
        });
    }
    const grupo = await fetch(origem + '/atendimento/gappus');
    assert.equal(grupo.status, 200); assert.ok((await grupo.text()).includes('GAPPUS — Lista de presença'));
    const invalida = await fetch(origem + '/voluntarios/escala-data?data=2026-02-30'); assert.equal(invalida.status, 400);
});

test('todas as telas novas renderizam com dados vazios e dados preenchidos, escapando relatos', async () => {
    const base = { terapias: op.MODALIDADES, modalidades: op.MODALIDADES, formatarData: op.formatarData, dataNascimentoISO: op.dataNascimentoISO, hoje: '2026-10-02', salvo: true };
    const assistido = { _id: cpf, nome_assistido: '<script>alert(1)</script>', status: 'Ativo' };
    const voluntario = { _id: cpf, nome: 'Voluntário', esta_ativo: 'Sim', disponibilidade: { reiki: ['sex'] } };
    const registro = { _id: id, data: '2026-10-02', modalidade: 'reiki', inicio: '09:00', fim: '10:00', cpf_voluntario: cpf, status: 'Confirmado' };
    const modalidadesEscala = [...op.MODALIDADES, { id: 'mesa', nome: 'Mesa', disponibilidade: 'mesa' }];
    const amostras = [
        ['assistidos', { assistidos: [assistido], total: 31, busca: '', status: '', numeroPagina: 1 }],
        ['assistidos', { assistidos: [], total: 0, busca: '', status: '', numeroPagina: 1 }],
        ['assistido', { assistido, historico: [] }],
        ['assistido', { assistido, historico: [{ data: new Date(), tipo: 'reiki', observacoes: '<script>alert(1)</script>' }] }],
        ['configuracoes', { dias: op.DIAS, configuracoes: op.MODALIDADES.map(m => ({ ...m, ativa: true, limites: {}, limites_espera: { sexta: 2 }, limite_principal: 0, limite_espera: 0, intervalo_dias: 27, intervalo_sem_retorno_dias: 90 })) }],
        ['escala', { data: '2026-10-02', registros: [registro], voluntarios: [voluntario], mapa: new Map([[cpf, voluntario]]), modalidadesEscala, dia: 'sex' }],
        ['escala', { data: '2026-10-02', registros: [], voluntarios: [], mapa: new Map(), modalidadesEscala, dia: 'sex' }],
        ['erro', { mensagem: 'Entrada inválida' }]
    ];
    for (const [tela, dados] of amostras) {
        const html = await ejs.renderFile(path.join(__dirname, '..', 'views', 'gestao', `${tela}.ejs`), { ...base, ...dados });
        assert.ok(html.includes('<main'), tela); assert.equal(html.includes('<script>alert(1)</script>'), false, tela);
    }
});
