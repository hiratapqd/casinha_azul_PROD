const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ejs = require('ejs');
const path = require('node:path');
const Participante = require('../src/models/ParticipanteGappus');
const Atendimento = require('../src/models/Atendimento');
const Assistido = require('../src/models/Assistido');
const Encontro = require('../src/models/EncontroGappus');
const Voluntario = require('../src/models/Voluntario');
const Fluxo = require('../src/models/ConfiguracaoFluxo');
const Limite = require('../src/models/LimiteAtendimento');
const Solicitacao = require('../src/models/Solicitacao');
const atendimento = require('../src/controllers/AtendimentoController');
const gappus = require('../src/controllers/GappusController');
const gestao = require('../src/controllers/GestaoController');
const { montarLista } = require('../src/services/ParticipantesGappus');
const op = require('../src/utils/operacao');
const cpfPai = '12345678906', cpfResponsavel = '12345678908';
const idMae = '507f1f77bcf86cd799439015';
function consulta(dados) { return { sort() { return this; }, limit() { return this; }, lean: async () => dados }; }
function resposta() { return { codigo: 200, status(c) { this.codigo = c; return this; }, json(dados) { this.dados = dados; }, render(tela, dados) { this.tela = tela; this.dados = dados; }, redirect(url) { this.url = url; } }; }
function configurar(t) {
    const anterior = mongoose.connection.db;
    mongoose.connection.db = { collection: () => ({ find: () => ({ toArray: async () => [] }) }) };
    t.after(() => { mongoose.connection.db = anterior; });
    t.mock.method(Fluxo, 'find', () => consulta([{ terapia: 'apometria', requerSolicitacaoPrevia: false }]));
    t.mock.method(Limite, 'find', () => consulta([]));
    t.mock.method(Solicitacao, 'findOne', () => consulta(null));
    t.mock.method(Assistido, 'findById', cpf => consulta(cpf === cpfPai ? { _id: cpfPai, nome_assistido: 'Pai' } : null));
}
test.beforeEach(t => {
    t.mock.method(Participante, 'find', () => consulta([]));
    t.mock.method(Atendimento, 'find', () => consulta([]));
    t.mock.method(Assistido, 'find', () => consulta([]));
});
function familiar() { return { _id: idMae, nome: 'Mãe', papel: 'Familiar', vinculo_nome: 'mãe de Filho', inclusao_manual: true, data_inicio: '2026-01-01', status: 'Ativo' }; }

test('GAPPUS usa a indicação da última apometria até a data do encontro', async t => {
    const hoje = op.hojeLocal(), ontem = op.somarDiasISO(hoje, -1), amanha = op.somarDiasISO(hoje, 1);
    t.mock.method(Assistido, 'find', () => consulta([{ _id: cpfPai, nome_assistido: 'Pai' }]));
    t.mock.method(Atendimento, 'find', () => consulta([
        { cpf_assistido: cpfPai, data: op.inicioDia(amanha), gappus_indicado: true },
        { cpf_assistido: cpfPai, data: op.inicioDia(hoje), gappus_indicado: false },
        { cpf_assistido: cpfPai, data: op.inicioDia(ontem), gappus_indicado: true }
    ]));
    assert.equal((await montarLista(ontem, null)).participantes.length, 1);
    assert.equal((await montarLista(hoje, null)).participantes.length, 0);
    assert.equal((await montarLista(amanha, null)).participantes.length, 1);
});
function reqApi(body = {}, params = {}) { return { body, params, headers: { accept: 'application/json' } }; }

for (const standalone of [false, true]) test(`apometria em intenção de outra pessoa salva atendimento do pai e inclui pai e filho no GAPPUS ${standalone ? 'sem' : 'com'} transação`, async t => {
    configurar(t);
    t.mock.method(mongoose.connection, 'transaction', async callback => {
        if (standalone) throw Object.assign(new Error('Transaction numbers are only allowed on a replica set member or mongos'), { code: 20 });
        return callback({ transacao: true });
    });
    let salvo;
    t.mock.method(Atendimento.prototype, 'save', async function () { await this.validate(); salvo = this; });
    const res = resposta(); await atendimento.salvarAtendimento({ body: { tipo: 'apometria', cpf_assistido: cpfPai, voluntario: 'Terapeuta',
        para_terceiro: 'on', beneficiario_nome: 'Filho', beneficiario_parentesco: 'filho', gappus_indicado: 'on' } }, res);
    assert.equal(res.codigo, 200); assert.equal(salvo.cpf_assistido, cpfPai);
    t.mock.method(Atendimento, 'find', () => consulta([salvo]));
    assert.equal(salvo.beneficiario.nome, 'Filho');
    t.mock.method(Assistido, 'find', () => consulta([{ _id: cpfPai, nome_assistido: 'Pai' }]));
    let lista = await montarLista(op.hojeLocal(), null);
    assert.equal(lista.participantes.length, 2); assert.equal(lista.participantes.find(p => p.id === cpfPai).papel, 'Atendido');
    assert.equal(lista.participantes.find(p => p.nome === 'Filho').papel, 'Assistido');
    t.mock.method(Participante, 'find', () => consulta([familiar()]));
    lista = await montarLista(op.hojeLocal(), null);
    assert.equal(lista.participantes.length, 3); assert.ok(lista.participantes.every(p => !p.presente));
});

test('apometria para terceiro valida beneficiário sem exigir plano', async t => {
    configurar(t);
    const gravar = t.mock.method(Atendimento.prototype, 'save', async () => {});
    for (const extras of [{ beneficiario_nome: '' }, { beneficiario_cpf: cpfPai }, { beneficiario_cpf: '123' }]) {
        const res = resposta(); await atendimento.salvarAtendimento({ body: { tipo: 'apometria', cpf_assistido: cpfPai, para_terceiro: 'on', beneficiario_nome: 'Filho', ...extras } }, res);
        assert.equal(res.codigo, 400);
    }
    assert.equal(gravar.mock.callCount(), 0);
});


test('cadastro manual de familiar sem CPF recebe identidade própria e reaparece nos encontros seguintes', async t => {
    configurar(t);
    let criado;
    t.mock.method(Participante, 'findOneAndUpdate', async (filtro, update) => { criado = { _id: filtro._id, ...update.$set }; await new Participante(criado).validate(); return criado; });
    const res = resposta(); await gappus.adicionarParticipante(reqApi({ nome: 'Mãe', papel: 'Familiar', vinculo_nome: 'mãe de Filho', data: op.hojeLocal() }), res);
    assert.equal(res.codigo, 200); assert.match(res.dados.id, /^[a-f\d]{24}$/); assert.equal(res.dados.cpf, undefined);
    t.mock.method(Participante, 'find', () => consulta([criado]));
    const lista = await montarLista(op.somarDiasISO(op.hojeLocal(), 7), null);
    assert.equal(lista.participantes[0].id, res.dados.id); assert.equal(lista.participantes[0].vinculo_nome, 'mãe de Filho');
});

test('desistência tira participante das próximas listas e preserva as presenças históricas e os atendimentos', async t => {
    let pessoa = familiar();
    t.mock.method(Participante, 'find', () => consulta([pessoa]));
    t.mock.method(Participante, 'findOneAndUpdate', async (filtro, update) => { pessoa = { ...pessoa, ...update.$set }; return pessoa; });
    const atendimentos = t.mock.method(Atendimento, 'deleteMany', async () => {});
    const listas = t.mock.method(Encontro, 'updateMany', async () => {});
    const res = resposta(); await gappus.desistir(reqApi({}, { id: idMae }), res);
    assert.equal(res.dados.status, 'Desistiu'); assert.equal(atendimentos.mock.callCount(), 0); assert.equal(listas.mock.callCount(), 0);
    let lista = await montarLista(op.hojeLocal(), null); assert.equal(lista.participantes.length, 0); assert.equal(lista.desistentes.length, 1);
    const salvo = { participantes: [{ participante_id: idMae, nome: 'Mãe', papel: 'Familiar' }] };
    lista = await montarLista(op.hojeLocal(), salvo); assert.equal(lista.participantes.length, 1); assert.equal(lista.participantes[0].presente, true); assert.equal(lista.participantes[0].desistiu, true);
    lista = await montarLista(op.somarDiasISO(op.hojeLocal(), -1), null); assert.equal(lista.participantes.length, 1, 'Desistência não esconde o nome nas datas anteriores');
});

test('retomar acompanhamento reutiliza a identidade do participante sem duplicar histórico', async t => {
    const pessoa = { ...familiar(), status: 'Desistiu', desistencia_em: new Date() };
    t.mock.method(Participante, 'find', () => consulta([pessoa]));
    let filtro, update;
    t.mock.method(Participante, 'findOneAndUpdate', async (f, u) => { filtro = f; update = u; });
    const res = resposta(); await gappus.retomar(reqApi({}, { id: idMae }), res);
    assert.equal(res.dados.id, idMae); assert.equal(filtro._id, idMae); assert.equal(update.$set.status, 'Ativo'); assert.equal(update.$unset.desistencia_em, 1);
});

test('uma lista antiga aberta antes da desistência não cria nova presença para quem desistiu', async t => {
    configurar(t);
    t.mock.method(Participante, 'find', () => consulta([{ ...familiar(), status: 'Desistiu', desistencia_em: new Date() }]));
    t.mock.method(Voluntario, 'findById', () => consulta({ _id: cpfResponsavel, nome: 'Responsável', esta_ativo: 'Sim', disponibilidade: { gappus: ['sex'] } }));
    let existente = null;
    t.mock.method(Encontro, 'findById', () => consulta(existente));
    const gravar = t.mock.method(Encontro, 'findOneAndUpdate', async () => ({}));
    const req = { body: { data: op.hojeLocal(), versao: '0', responsavel_cpf: cpfResponsavel, participantes: [idMae] } };
    const recusado = resposta(); await gappus.salvar(req, recusado); assert.equal(recusado.codigo, 409); assert.equal(gravar.mock.callCount(), 0);
    existente = { responsavel_cpf: cpfResponsavel, participantes: [{ participante_id: idMae, nome: 'Mãe' }] };
    const historico = resposta(); await gappus.salvar(req, historico); assert.ok(historico.url); assert.equal(gravar.mock.callCount(), 1);
});

test('consulta de presenças funciona pelo identificador mesmo sem CPF e mantém pessoas homônimas separadas', async t => {
    const homonimo = { ...familiar(), _id: '507f1f77bcf86cd799439016' };
    t.mock.method(Participante, 'find', () => consulta([familiar(), homonimo]));
    let filtro;
    t.mock.method(Encontro, 'find', f => { filtro = f; return consulta([{ _id: '2026-10-01', responsavel_nome: 'Responsável' }, { _id: '2026-10-02', responsavel_nome: 'Responsável' }]); });
    const res = resposta(); await gappus.presencasParticipante({ params: { id: idMae } }, res);
    assert.deepEqual(filtro, { $or: [{ 'participantes.participante_id': idMae }] }); assert.equal(res.dados.encontros.length, 2);
    const html = await ejs.renderFile(path.join(__dirname, '..', 'views', 'gestao', 'gappus_participante.ejs'), { ...res.dados, terapias: [] });
    assert.ok(html.includes('2 presença(s) registrada(s)'));
    const busca = resposta(); await gappus.buscarParticipantes({ query: { busca: 'Mãe' } }, busca);
    assert.equal(busca.dados.length, 2); assert.notEqual(busca.dados[0].id, busca.dados[1].id);
});

test('presença salva identificadores separados para pai, filho e mãe sem exigir CPF de todos', async t => {
    configurar(t);
    const filhoId = '507f1f77bcf86cd799439017';
    t.mock.method(Participante, 'find', () => consulta([familiar()]));
    t.mock.method(Atendimento, 'find', () => consulta([{ cpf_assistido: cpfPai, para_terceiro: true, beneficiario: { participante_id: filhoId, nome: 'Filho' }, gappus_indicado: true, tipo: 'apometria', data: new Date() }]));
    t.mock.method(Assistido, 'find', () => consulta([{ _id: cpfPai, nome_assistido: 'Pai' }]));
    t.mock.method(Voluntario, 'findById', () => consulta({ _id: cpfResponsavel, nome: 'Responsável', esta_ativo: 'Sim', disponibilidade: { gappus: ['sex'] } }));
    t.mock.method(Encontro, 'findById', () => consulta(null));
    let salvo;
    t.mock.method(Encontro, 'findOneAndUpdate', async (f, update) => { salvo = update.$set; await new Encontro({ _id: op.hojeLocal(), ...salvo }).validate(); return {}; });
    const res = resposta(); await gappus.salvar({ body: { data: op.hojeLocal(), versao: '0', responsavel_cpf: cpfResponsavel, participantes: [cpfPai, filhoId, idMae] } }, res);
    assert.ok(res.url); assert.deepEqual(salvo.participantes.map(p => p.papel), ['Atendido', 'Assistido', 'Familiar']);
    assert.equal(salvo.participantes.filter(p => p.cpf).length, 1); assert.equal(new Set(salvo.participantes.map(p => p.participante_id)).size, 3);
});
