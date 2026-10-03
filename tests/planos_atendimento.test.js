const test = require('node:test');
const assert = require('node:assert/strict');
const ejs = require('ejs');
const path = require('node:path');
const Modelo = require('../src/models/PlanoAtendimento');
const Atendimento = require('../src/models/Atendimento');
const gestao = require('../src/controllers/GestaoController');
const { PLANOS_ATENDIMENTO, listarPlanosAtendimento, obterPlanoAtendimento } = require('../src/services/PlanosAtendimento');
const op = require('../src/utils/operacao');
const id = 'custom_507f1f77bcf86cd799439011';
const consulta = dados => ({ sort() { return this; }, lean: async () => dados });
const resposta = () => ({ codigo: 200, status(c) { this.codigo = c; return this; }, render(tela, dados) { this.dados = dados; }, redirect(url) { this.url = url; } });
test('quatro combinações restauradas e três passes como padrão', async () => {
    assert.deepEqual(PLANOS_ATENDIMENTO.map(p => p.metas.map(m => [m.terapia, m.sessoes_previstas])), [
        [['passe', 3]], [['passe', 3], ['reiki', 3]], [['passe', 3], ['reiki', 3], ['auriculo', 3]], [['passe', 3], ['auriculo', 3]]
    ]);
    assert.equal((await obterPlanoAtendimento()).id, 'passes');
});
test('novo plano é salvo, listado e selecionável sem alterar os planos fixos', async t => {
    let salvo;
    t.mock.method(Modelo, 'create', async dados => { await new Modelo(dados).validate(); salvo = dados; });
    const res = resposta();
    await gestao.criarPlanoAtendimento({ body: { nome: 'Plano personalizado', sessoes_apometria: '1', sessoes_passe: '2', sessoes_reiki: '4', sessoes_auriculo: '0' } }, res);
    assert.equal(res.url, '/configuracoes?salvo=1#planos-atendimento');
    assert.match(salvo._id, /^custom_[a-f0-9]{24}$/);
    t.mock.method(Modelo, 'find', () => consulta([salvo]));
    t.mock.method(Modelo, 'findById', () => consulta(salvo));
    const planos = await listarPlanosAtendimento();
    assert.equal(planos.length, 5); assert.equal(planos[0].id, 'passes');
    const escolhido = await obterPlanoAtendimento(salvo._id);
    assert.deepEqual(escolhido.metas, [{ terapia: 'apometria', sessoes_previstas: 1 }, { terapia: 'passe', sessoes_previstas: 2 }, { terapia: 'reiki', sessoes_previstas: 4 }]);
    const atendimento = new Atendimento({ data: new Date(), cpf_assistido: '12345678906', voluntario: 'Terapeuta', tipo: 'apometria', plano_atendimento: { modelo: escolhido.id, nome: escolhido.nome, metas: escolhido.metas } });
    await atendimento.validate();
    salvo.nome = 'Alterado'; salvo.metas[0].sessoes_previstas = 10;
    assert.equal(atendimento.plano_atendimento.nome, 'Plano personalizado');
    assert.equal(atendimento.plano_atendimento.metas[0].sessoes_previstas, 1);
});
test('cadastro rejeita plano vazio, nome vazio e quantidades inválidas', async t => {
    const gravar = t.mock.method(Modelo, 'create', async () => {});
    for (const body of [{ nome: 'Vazio' }, { nome: '', sessoes_passe: '3' }, { nome: 'Negativo', sessoes_reiki: '-1' }, { nome: 'Decimal', sessoes_auriculo: '1.5' }, { nome: 'Acima do limite', sessoes_passe: '101' }]) {
        const res = resposta(); await gestao.criarPlanoAtendimento({ body }, res); assert.equal(res.codigo, 400);
    }
    assert.equal(gravar.mock.callCount(), 0);
});
test('edição muda somente o cadastro personalizado e protege os planos fixos', async t => {
    let update;
    const gravar = t.mock.method(Modelo, 'findByIdAndUpdate', async (chave, dados) => { assert.equal(chave, id); update = dados; return {}; });
    const body = { nome: 'Plano editado', sessoes_passe: '2', sessoes_reiki: '5' };
    const res = resposta(); await gestao.salvarPlanoAtendimento({ params: { id }, body }, res);
    assert.ok(res.url); assert.deepEqual(update.$set.metas, [{ terapia: 'passe', sessoes_previstas: 2 }, { terapia: 'reiki', sessoes_previstas: 5 }]);
    const fixo = resposta(); await gestao.salvarPlanoAtendimento({ params: { id: 'passes' }, body }, fixo);
    assert.equal(fixo.codigo, 400); assert.equal(gravar.mock.callCount(), 1);
    t.mock.method(Modelo, 'findByIdAndUpdate', async () => null);
    const ausente = resposta(); await gestao.salvarPlanoAtendimento({ params: { id }, body }, ausente); assert.equal(ausente.codigo, 404);
});
test('plano inexistente não é aceito', async t => {
    t.mock.method(Modelo, 'findById', () => consulta(null));
    await assert.rejects(obterPlanoAtendimento(id), { status: 400 });
    await assert.rejects(obterPlanoAtendimento('invalido'), { status: 400 });
});
test('configuração cria planos e ficha apométrica seleciona três passes e mantém retorno', async t => {
    t.mock.method(Modelo, 'find', () => consulta([{ _id: id, nome: '<Personalizado>', metas: [{ terapia: 'reiki', sessoes_previstas: 2 }] }]));
    const planos = await listarPlanosAtendimento();
    const base = { modalidades: op.MODALIDADES, terapias: op.MODALIDADES, planosAtendimento: planos, salvo: false, configuracoes: [], dias: op.DIAS };
    const configuracoes = await ejs.renderFile(path.join(__dirname, '..', 'views', 'gestao', 'configuracoes.ejs'), base);
    assert.match(configuracoes, /action="\/configuracoes\/planos-atendimento"/);
    assert.ok(configuracoes.includes('&lt;Personalizado&gt;'));
    const ficha = await ejs.renderFile(path.join(__dirname, '..', 'views', 'atendimento', 'apometrico.ejs'), base);
    assert.match(ficha, /value="passes" selected/); assert.match(ficha, /name="data_retorno"/); assert.ok(ficha.includes(`value="${id}"`));
    assert.equal(ficha.includes('plano_acompanhamento'), false);
});
