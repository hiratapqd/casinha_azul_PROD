const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ejs = require('ejs');
const mongoose = require('mongoose');
const Atendimento = require('../src/models/Atendimento');
const Assistido = require('../src/models/Assistido');
const Solicitacao = require('../src/models/Solicitacao');
const Voluntario = require('../src/models/Voluntario');
const Encontro = require('../src/models/EncontroGappus');
const Participante = require('../src/models/ParticipanteGappus');
const Fluxo = require('../src/models/ConfiguracaoFluxo');
const Limite = require('../src/models/LimiteAtendimento');
const atendimento = require('../src/controllers/AtendimentoController');
const gestao = require('../src/controllers/GestaoController');
const gappus = require('../src/controllers/GappusController');
const recepcao = require('../src/controllers/RecepcaoController');
const dashboard = require('../src/controllers/DashboardController');
const relatorios = require('../src/controllers/RelatorioController');
const Escala = require('../src/models/EscalaData');
const { identificarInterrompidos } = require('../src/services/AcompanhamentosHistoricos');
const op = require('../src/utils/operacao');
const cpf = '12345678906', outroCpf = '12345678907', voluntarioCpf = '12345678908';
const id = '507f1f77bcf86cd799439011';
function consulta(dados) { return { sort() { return this; }, limit() { return this; }, lean: async () => dados }; }
function resposta() { return { codigo: 200, status(c) { this.codigo = c; return this; },
    json(dados) { this.dados = dados; }, render(tela, dados) { this.tela = tela; this.dados = dados; }, redirect(url) { this.url = url; } }; }
function configurar(t, terapias = []) {
    const anterior = mongoose.connection.db;
    mongoose.connection.db = { collection: () => ({ find: () => ({ toArray: async () => terapias }) }) };
    t.after(() => { mongoose.connection.db = anterior; });
    t.mock.method(Fluxo, 'find', () => consulta([{ terapia: 'apometria', requerSolicitacaoPrevia: false }, { terapia: 'homeopatia', requerSolicitacaoPrevia: false }]));
    t.mock.method(Limite, 'find', () => consulta([]));
    t.mock.method(Solicitacao, 'findOne', () => consulta(null));
    t.mock.method(Assistido, 'findById', () => consulta({ _id: cpf, nome_assistido: 'Assistido' }));
}
function configurarGrupo(t, existente = null) {
    configurar(t);
    t.mock.method(Voluntario, 'findById', () => consulta({ _id: voluntarioCpf, nome: 'Responsável', esta_ativo: 'Sim', disponibilidade: { gappus: ['sex'] } }));
    t.mock.method(Encontro, 'findById', () => consulta(existente));
    t.mock.method(Assistido, 'find', () => consulta([{ _id: cpf, nome_assistido: 'Assistido' }]));
}
function bodyGrupo(mais = {}) { return { data: op.hojeLocal(), versao: '0', responsavel_cpf: voluntarioCpf, participantes: [cpf], ...mais }; }
test.beforeEach(t => {
    t.mock.method(Participante, 'find', () => consulta([]));
    t.mock.method(Atendimento, 'find', () => consulta([]));
});

for (const standalone of [false, true]) {
    test(`indicações de homeopatia e GAPPUS são preservadas no atendimento ${standalone ? 'sem transação' : 'com transação'}`, async t => {
        configurar(t);
        t.mock.method(mongoose.connection, 'transaction', async callback => {
            if (standalone) throw Object.assign(new Error('Transaction numbers are only allowed on a replica set member or mongos'), { code: 20 });
            return callback({ transacao: true });
        });
        let registro;
        t.mock.method(Atendimento.prototype, 'save', async function () { registro = this; });
        t.mock.method(Atendimento, 'find', () => consulta([]));
        const res = resposta();
        await atendimento.salvarAtendimento({ body: { cpf_assistido: cpf, tipo: 'apometria', voluntario: 'Terapeuta', homeopatia_indicada: 'on', gappus_indicado: 'on' } }, res);
        assert.equal(res.codigo, 200); assert.equal(registro.homeopatia_indicada, true); assert.equal(registro.gappus_indicado, true);
    });
}

test('modalidade adicional inativa é rejeitada antes de qualquer gravação', async t => {
    configurar(t, [{ terapia: 'gappus', ativa: false }]);
    const gravar = t.mock.method(Atendimento.prototype, 'save', async () => {});
    const res = resposta(); await atendimento.salvarAtendimento({ body: { tipo: 'apometria', cpf_assistido: cpf, gappus_indicado: 'on' } }, res);
    assert.equal(res.codigo, 400); assert.match(res.dados.mensagem, /Ative GAPPUS/); assert.equal(gravar.mock.callCount(), 0);
});

test('homeopatia exige retorno futuro e grava a data junto do atendimento', async t => {
    configurar(t);
    let registro;
    const gravar = t.mock.method(Atendimento.prototype, 'save', async function () { registro = this; });
    for (const data of ['', op.hojeLocal(), op.somarDiasISO(op.hojeLocal(), -1), '2026-02-30']) {
        const res = resposta(); await atendimento.salvarAtendimento({ body: { tipo: 'homeopatia', cpf_assistido: cpf, voluntario: 'Terapeuta', data_retorno: data } }, res);
        assert.equal(res.codigo, 400);
    }
    assert.equal(gravar.mock.callCount(), 0);
    const retorno = op.somarDiasISO(op.hojeLocal(), 30);
    const res = resposta(); await atendimento.salvarAtendimento({ body: { tipo: 'homeopatia', cpf_assistido: cpf, voluntario: 'Terapeuta', data_retorno: retorno } }, res);
    assert.equal(res.codigo, 200); assert.equal(registro.data_retorno, retorno);
});



test('presença GAPPUS após a apometria elimina a interrupção inferida pelo histórico', () => {
    const historico = [{ _id: cpf, atendimentos: [{ tipo: 'apometria', data: '2026-10-01T12:00:00Z' }, { tipo: 'passe', data: '2026-10-01T13:00:00Z' }] }];
    assert.equal(identificarInterrompidos(historico).length, 1);
    assert.equal(identificarInterrompidos(historico, [{ _id: '2026-10-02', participantes: [{ cpf }] }]).length, 0);
    assert.equal(identificarInterrompidos(historico, [{ _id: '2026-09-30', participantes: [{ cpf }] }]).length, 1);
});

test('lista por encontro deduplica CPFs e salva presenças sem criar atendimentos individuais', async t => {
    configurarGrupo(t);
    let filtro, dados, opcoes;
    t.mock.method(Encontro, 'findOneAndUpdate', async (f, d, o) => { filtro = f; dados = d; opcoes = o; return { _id: f._id }; });
    const atender = t.mock.method(Atendimento.prototype, 'save', async () => {});
    const res = resposta(); await gappus.salvar({ body: bodyGrupo({ participantes: [cpf, cpf] }) }, res);
    assert.ok(res.url); assert.deepEqual(filtro, { _id: op.hojeLocal(), versao: 0 }); assert.equal(opcoes.upsert, true);
    assert.deepEqual(dados.$set.participantes, [{ participante_id: cpf, cpf, nome: 'Assistido', papel: 'Assistido' }]); assert.equal(dados.$inc.versao, 1); assert.equal(atender.mock.callCount(), 0);
    await new Encontro({ _id: filtro._id, ...dados.$set }).validate();
});

test('editar encontro permite remover presença e protege alterações feitas em outra tela', async t => {
    configurarGrupo(t, { _id: op.hojeLocal(), responsavel_cpf: voluntarioCpf, responsavel_nome: 'Responsável', versao: 1 });
    let update;
    t.mock.method(Encontro, 'findOneAndUpdate', async (filtro, dados, opcoes) => { update = dados; assert.equal(opcoes.upsert, false); return { _id: filtro._id }; });
    const res = resposta(); await gappus.salvar({ body: bodyGrupo({ versao: '1', participantes: [] }) }, res);
    assert.ok(res.url); assert.deepEqual(update.$set.participantes, []);
    t.mock.method(Encontro, 'findOneAndUpdate', async () => null);
    const conflito = resposta(); await gappus.salvar({ body: bodyGrupo({ versao: '1' }) }, conflito);
    assert.equal(conflito.codigo, 409); assert.match(conflito.dados.mensagem, /outra tela/);
});

test('presença rejeita data futura, participante desconhecido e responsável sem disponibilidade', async t => {
    configurarGrupo(t);
    const gravar = t.mock.method(Encontro, 'findOneAndUpdate', async () => ({}));
    const futuro = resposta(); await gappus.salvar({ body: bodyGrupo({ data: op.somarDiasISO(op.hojeLocal(), 1) }) }, futuro);
    assert.equal(futuro.codigo, 400);
    const desconhecido = resposta(); await gappus.salvar({ body: bodyGrupo({ participantes: [outroCpf] }) }, desconhecido);
    assert.equal(desconhecido.codigo, 400);
    t.mock.method(Voluntario, 'findById', () => consulta({ _id: voluntarioCpf, esta_ativo: 'Sim', disponibilidade: {} }));
    const responsavel = resposta(); await gappus.salvar({ body: bodyGrupo() }, responsavel);
    assert.equal(responsavel.codigo, 400); assert.equal(gravar.mock.callCount(), 0);
});

test('GAPPUS usa apenas lista de presença, sem check-in ou finalização individual', async t => {
    configurar(t);
    const fila = t.mock.method(Solicitacao, 'findOneAndUpdate', async () => {});
    const res = resposta(); await recepcao.realizarCheckin({ body: { cpf, terapias: ['gappus'] } }, res);
    assert.equal(res.codigo, 400); assert.equal(fila.mock.callCount(), 0);
    const individual = resposta(); await atendimento.salvarAtendimento({ body: { cpf_assistido: cpf, tipo: 'gappus' } }, individual);
    assert.equal(individual.codigo, 400); assert.match(individual.dados.mensagem, /lista de presença/);
});

test('lista apresenta encaminhados e participantes já salvos, escapando nomes e observações', async t => {
    configurar(t);
    const encontro = { _id: op.hojeLocal(), versao: 1, responsavel_cpf: voluntarioCpf, responsavel_nome: 'Responsável',
        participantes: [{ cpf: outroCpf, nome: '<script>Participante</script>' }], observacoes: '<script>Relato</script>' };
    t.mock.method(Encontro, 'findById', () => consulta(encontro));
    t.mock.method(Encontro, 'find', () => consulta([encontro]));
    t.mock.method(Atendimento, 'find', () => consulta([{ cpf_assistido: cpf, gappus_indicado: true, tipo: 'apometria', data: new Date() }]));
    t.mock.method(Voluntario, 'find', () => consulta([]));
    t.mock.method(Assistido, 'find', () => consulta([{ _id: cpf, nome_assistido: 'Encaminhado' }]));
    const res = resposta(); await gappus.formulario({ query: {} }, res);
    assert.equal(res.dados.participantes.length, 2); assert.equal(res.dados.participantes.find(p => p.cpf === cpf).presente, false);
    assert.equal(res.dados.participantes.find(p => p.cpf === outroCpf).presente, true);
    const html = await ejs.renderFile(path.join(__dirname, '..', 'views', 'gestao', 'gappus.ejs'), { ...res.dados, terapias: op.MODALIDADES });
    assert.ok(html.includes('&lt;script&gt;Participante&lt;/script&gt;')); assert.ok(html.includes('&lt;script&gt;Relato&lt;/script&gt;'));
    assert.ok(html.includes('name="versao" value="1"'));
    for (const bloco of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new Function(bloco[1]);
});

test('painel e relatório de inativos consideram presença GAPPUS como retorno, sem somar atendimento individual', async t => {
    const historico = [{ cpf_assistido: cpf, tipo: 'apometria', data: '2026-01-01T12:00:00Z' },
        { cpf_assistido: cpf, tipo: 'passe', data: '2026-01-01T13:00:00Z' }];
    const encontro = { _id: op.hojeLocal(), participantes: [{ cpf }, { cpf: outroCpf }] };
    t.mock.method(Atendimento, 'find', () => consulta(historico));
    t.mock.method(Atendimento, 'aggregate', async () => []);
    t.mock.method(Atendimento, 'countDocuments', async () => 0);
    t.mock.method(Voluntario, 'find', () => consulta([]));
    t.mock.method(Escala, 'find', () => consulta([]));
    t.mock.method(Encontro, 'find', () => consulta([encontro]));
    t.mock.method(Encontro, 'findById', () => consulta(encontro));
    const painel = resposta(); await dashboard.getDashboard({}, painel);
    assert.equal(painel.dados.resumo.gappusHoje, 2); assert.equal(painel.dados.resumo.hoje, 0);
    assert.equal(painel.dados.resumo.apometriaUnica, 0); assert.equal(painel.dados.resumo.totalBaseApometria, 1);
    t.mock.method(Atendimento, 'aggregate', async () => [{ _id: cpf, atendimentos: historico }]);
    t.mock.method(Assistido, 'find', () => consulta([]));
    const inativos = resposta(); await relatorios.getApometriaInativos({}, inativos);
    assert.deepEqual(inativos.dados.counts, { d30: 0, d60: 0, d90: 0 });
});

test('card e relatório contam quatro históricos completos, excluindo três com terapias anteriores', async t => {
    const historico = [];
    for (let i = 0; i < 7; i++) {
        const cpfAssistido = String(12345678910 + i);
        historico.push({ cpf_assistido: cpfAssistido, tipo: 'apometria', data: '2026-01-01T12:00:00Z' },
            { cpf_assistido: cpfAssistido, tipo: 'passe', data: '2026-01-01T13:00:00Z' });
        if (i >= 4) historico.push({ cpf_assistido: cpfAssistido, tipo: 'reiki', data: '2025-12-01T12:00:00Z' });
    }
    t.mock.method(Atendimento, 'find', () => consulta(historico));
    t.mock.method(Atendimento, 'aggregate', async () => []);
    t.mock.method(Atendimento, 'countDocuments', async () => 0);
    t.mock.method(Voluntario, 'find', () => consulta([]));
    t.mock.method(Escala, 'find', () => consulta([]));
    t.mock.method(Encontro, 'find', () => consulta([]));
    t.mock.method(Encontro, 'findById', () => consulta(null));
    const painel = resposta(); await dashboard.getDashboard({}, painel);
    assert.equal(painel.dados.resumo.apometriaUnica, 4);
    assert.equal(painel.dados.resumo.totalBaseApometria, 7);
    assert.equal(painel.dados.resumo.taxaAbandono, '57.14');
    // O agregado pode separar CPFs com e sem máscara; a regra reúne o histórico.
    t.mock.method(Atendimento, 'aggregate', async () => historico.map(a => ({ _id: a.cpf_assistido, atendimentos: [a] })));
    t.mock.method(Assistido, 'find', () => consulta([]));
    const relatorio = resposta(); await relatorios.getApometriaInativos({}, relatorio);
    assert.equal(Object.values(relatorio.dados.counts).reduce((a, b) => a + b, 0), 4);
});

test('abandono exige uma sessão de cada, considera máscaras de CPF e exclui qualquer outra participação', () => {
    const { resumirAbandonoApometria } = require('../src/services/AcompanhamentosHistoricos');
    const par = [{ cpf_assistido: cpf, tipo: ' Apometria ', data: '2026-01-01T12:00:00Z' },
        { cpf_assistido: '123.456.789-06', tipo: 'PASSE', data: '2026-01-01T13:00:00Z' }];
    assert.equal(resumirAbandonoApometria(par).candidatos.length, 1);
    for (const extra of [
        { ...par[0], data: '2025-12-01T12:00:00Z' },
        { ...par[1], data: '2026-01-02T12:00:00Z' },
        { ...par[0], tipo: 'auriculo', data: '2025-12-01T12:00:00Z' },
        { ...par[0], tipo: 'reiki', data: '2026-01-02T12:00:00Z' },
        { ...par[0], tipo: 'homeopatia', data: 'inválida' }
    ]) assert.equal(resumirAbandonoApometria([...par, extra]).candidatos.length, 0);
    assert.equal(resumirAbandonoApometria(par, [{ _id: '2025-12-01', participantes: [{ cpf }] }]).candidatos.length, 0);
    assert.equal(resumirAbandonoApometria([par[0], { ...par[1], data: 'inválida' }]).candidatos.length, 0);
    assert.equal(resumirAbandonoApometria([par[0], { ...par[1], data: '2025-12-01' }]).candidatos.length, 0);
    assert.deepEqual(resumirAbandonoApometria([]), { totalBase: 0, candidatos: [] });
});

test('GAPPUS inativo impede encontro novo e permite correção de uma lista existente', async t => {
    configurarGrupo(t);
    mongoose.connection.db.collection = () => ({ find: () => ({ toArray: async () => [{ terapia: 'gappus', ativa: false }] }) });
    const gravar = t.mock.method(Encontro, 'findOneAndUpdate', async () => ({ _id: op.hojeLocal() }));
    const novo = resposta(); await gappus.salvar({ body: bodyGrupo() }, novo);
    assert.equal(novo.codigo, 400); assert.equal(gravar.mock.callCount(), 0);
    t.mock.method(Encontro, 'findById', () => consulta({ _id: op.hojeLocal(), responsavel_cpf: voluntarioCpf, responsavel_nome: 'Responsável', versao: 1 }));
    const editar = resposta(); await gappus.salvar({ body: bodyGrupo({ versao: '1' }) }, editar);
    assert.ok(editar.url); assert.equal(gravar.mock.callCount(), 1);
});
