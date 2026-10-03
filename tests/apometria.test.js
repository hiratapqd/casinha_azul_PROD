const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ejs = require('ejs');
const mongoose = require('mongoose');
const Atendimento = require('../src/models/Atendimento');
const Assistido = require('../src/models/Assistido');
const Solicitacao = require('../src/models/Solicitacao');
const Fluxo = require('../src/models/ConfiguracaoFluxo');
const Limite = require('../src/models/LimiteAtendimento');
const controller = require('../src/controllers/AtendimentoController');
const { salvarSemTransacao } = require('../src/services/ApometriaSemTransacao');
const op = require('../src/utils/operacao');
const cpf = '12345678906';
test.beforeEach(t => {
    t.mock.method(require('../src/models/PlanoAtendimento'), 'find', () => consulta([]));
});
function consulta(dados) { return { sort() { return this; }, lean: async () => dados }; }
function resposta() { return { codigo: 200, status(c) { this.codigo = c; return this; }, json(dados) { this.dados = dados; } }; }
function configurar(t) {
    const anterior = mongoose.connection.db;
    mongoose.connection.db = { collection: () => ({ find: () => ({ toArray: async () => [] }) }) };
    t.after(() => { mongoose.connection.db = anterior; });
    t.mock.method(Fluxo, 'find', () => consulta([{ terapia: 'apometria', requerSolicitacaoPrevia: false, geraPasseAoFinalizar: true }]));
    t.mock.method(Limite, 'find', () => consulta([]));
    t.mock.method(Assistido, 'findById', () => consulta({ _id: cpf, nome_assistido: 'Assistido' }));
    t.mock.method(Solicitacao, 'findOne', () => consulta(null));
}
function dadosStandalone() {
    return { dadosAtendimento: { cpf_assistido: cpf, nome_assistido: 'Assistido', tipo: 'apometria', voluntario: 'Terapeuta', data: new Date(), data_retorno: op.somarDiasISO(op.hojeLocal(), 30) },
        solicitacao: { _id: `${cpf}_${op.hojeLocal()}`, status: 'Confirmado' }, encaminharPasse: true, hoje: op.hojeLocal() };
}
for (const standalone of [false, true]) test(`apometria salva retorno e encaminha passe sem planos ${standalone ? 'sem' : 'com'} transação`, async t => {
    configurar(t);
    const session = {};
    t.mock.method(mongoose.connection, 'transaction', async callback => {
        if (standalone) throw Object.assign(new Error('Transaction numbers are only allowed on a replica set member or mongos'), { code: 20 });
        return callback(session);
    });
    let salvo, passe;
    t.mock.method(Atendimento.prototype, 'save', async function (opcoes) { await this.validate(); salvo = this; if (!standalone) assert.equal(opcoes.session, session); });
    t.mock.method(Solicitacao, 'findOneAndUpdate', async (filtro, update) => { if (update.$setOnInsert) passe = update.$setOnInsert; return {}; });
    const retorno = op.somarDiasISO(op.hojeLocal(), 30);
    const res = resposta(); await controller.salvarAtendimento({ body: { tipo: 'apometria', cpf_assistido: cpf, voluntario: 'Terapeuta', data_retorno: retorno, plano_acompanhamento: 'legado' } }, res);
    assert.equal(res.codigo, 200); assert.equal(salvo.data_retorno, retorno); assert.equal(salvo.toObject().plano_acompanhamento, undefined);
    assert.equal(salvo.plano_atendimento.modelo, 'passes');
    assert.deepEqual(salvo.plano_atendimento.metas.map(m => m.toObject()), [{ terapia: 'passe', sessoes_previstas: 3 }]);
    assert.deepEqual(res.dados, { status: 'sucesso', encaminhadoPasse: true });
    assert.equal(passe.passe_pos_apometria, true); assert.equal(String(passe.apometria_origem), String(salvo._id));
});
test('apometria registra um plano personalizado com retorno e rejeita seleção inexistente', async t => {
    configurar(t);
    const modelo = { _id: 'custom_507f1f77bcf86cd799439011', nome: 'Reiki e Aurículo', metas: [{ terapia: 'reiki', sessoes_previstas: 2 }, { terapia: 'auriculo', sessoes_previstas: 4 }] };
    t.mock.method(require('../src/models/PlanoAtendimento'), 'findById', () => consulta(modelo));
    t.mock.method(mongoose.connection, 'transaction', async callback => callback({}));
    let salvo;
    const gravar = t.mock.method(Atendimento.prototype, 'save', async function () { await this.validate(); salvo = this; });
    t.mock.method(Solicitacao, 'findOneAndUpdate', async () => ({}));
    const body = { tipo: 'apometria', cpf_assistido: cpf, voluntario: 'Terapeuta', plano_atendimento: modelo._id, data_retorno: op.somarDiasISO(op.hojeLocal(), 30) };
    const res = resposta(); await controller.salvarAtendimento({ body }, res);
    assert.equal(res.codigo, 200); assert.equal(salvo.plano_atendimento.modelo, modelo._id);
    assert.deepEqual(salvo.plano_atendimento.metas.map(m => m.toObject()), modelo.metas); assert.equal(salvo.data_retorno, body.data_retorno);
    t.mock.method(require('../src/models/PlanoAtendimento'), 'findById', () => consulta(null));
    t.mock.method(console, 'error', () => {});
    const ausente = resposta(); await controller.salvarAtendimento({ body }, ausente);
    assert.equal(ausente.codigo, 400); assert.equal(gravar.mock.callCount(), 1);
});

test('retorno apométrico inválido ou anterior ao próximo dia é rejeitado antes de gravar', async t => {
    configurar(t);
    const gravar = t.mock.method(Atendimento.prototype, 'save', async () => {});
    for (const data of ['2026-02-30', op.hojeLocal(), op.somarDiasISO(op.hojeLocal(), -1), 'inválido']) {
        const res = resposta(); await controller.salvarAtendimento({ body: { tipo: 'apometria', cpf_assistido: cpf, data_retorno: data } }, res);
        assert.equal(res.codigo, 400); assert.match(res.dados.mensagem, /retorno/);
    }
    assert.equal(gravar.mock.callCount(), 0);
});
test('apometria permite deixar o retorno em branco', async t => {
    configurar(t);
    t.mock.method(mongoose.connection, 'transaction', async callback => callback({}));
    let salvo;
    t.mock.method(Atendimento.prototype, 'save', async function () { salvo = this; });
    t.mock.method(Solicitacao, 'findOneAndUpdate', async () => ({}));
    const res = resposta(); await controller.salvarAtendimento({ body: { tipo: 'apometria', cpf_assistido: cpf, voluntario: 'Terapeuta', data_retorno: '' } }, res);
    assert.equal(res.codigo, 200); assert.equal(salvo.data_retorno, undefined);
});
test('solicitação finalizada impede uma segunda apometria', async t => {
    configurar(t);
    t.mock.method(Solicitacao, 'findOne', () => consulta({ _id: 'solicitacao', status: 'Confirmado' }));
    t.mock.method(Solicitacao, 'findOneAndUpdate', async () => null);
    t.mock.method(mongoose.connection, 'transaction', async callback => callback({}));
    t.mock.method(console, 'error', () => {});
    const gravar = t.mock.method(Atendimento.prototype, 'save', async () => {});
    const res = resposta(); await controller.salvarAtendimento({ body: { tipo: 'apometria', cpf_assistido: cpf, voluntario: 'Terapeuta' } }, res);
    assert.equal(res.codigo, 409); assert.equal(gravar.mock.callCount(), 0);
});
test('falha de encaminhamento standalone recupera apenas a tentativa e libera a solicitação', async t => {
    t.mock.method(Atendimento.prototype, 'save', async () => {});
    t.mock.method(Solicitacao, 'findOneAndUpdate', async (filtro, update) => { if (update.$setOnInsert) throw new Error('Falha no passe'); return {}; });
    const passe = t.mock.method(Solicitacao, 'deleteOne', async () => {});
    const atendimento = t.mock.method(Atendimento, 'deleteOne', async () => {});
    const liberar = t.mock.method(Solicitacao, 'updateOne', async () => {});
    await assert.rejects(salvarSemTransacao(dadosStandalone()), /Falha no passe/);
    assert.equal(atendimento.mock.callCount(), 1); assert.equal(liberar.mock.callCount(), 1);
    assert.ok(passe.mock.calls[0].arguments[0].finalizacao_atendimento); assert.equal(passe.mock.calls[0].arguments[0].status, 'Confirmado');
    assert.equal(liberar.mock.calls[0].arguments[1].$set.status, 'Confirmado');
});
test('recuperação incompleta mantém a reserva para impedir duplicação', async t => {
    t.mock.method(Atendimento.prototype, 'save', async () => { throw new Error('Falha'); });
    t.mock.method(Solicitacao, 'findOneAndUpdate', async () => ({}));
    t.mock.method(Solicitacao, 'deleteOne', async () => {});
    t.mock.method(Atendimento, 'deleteOne', async () => { throw new Error('Banco indisponível'); });
    t.mock.method(console, 'error', () => {});
    const liberar = t.mock.method(Solicitacao, 'updateOne', async () => {});
    await assert.rejects(salvarSemTransacao(dadosStandalone()), /recuperação não foi concluída/); assert.equal(liberar.mock.callCount(), 0);
});
test('formulários não exibem planos de acompanhamento e histórico mostra o retorno gravado', async () => {
    const base = { terapias: op.MODALIDADES, modalidades: op.MODALIDADES, formatarData: op.formatarData, dataNascimentoISO: op.dataNascimentoISO, hoje: op.hojeLocal(), salvo: false };
    const apometria = await ejs.renderFile(path.join(__dirname, '..', 'views', 'atendimento', 'apometrico.ejs'), base);
    assert.match(apometria, /name="data_retorno"/); assert.match(apometria, /Data esperada de retorno/); assert.equal(apometria.includes('plano_acompanhamento'), false);
    assert.equal(apometria.includes('Pessoas encontradas:'), false);
    assert.equal(apometria.includes('beneficiario_cadastrado'), false);
    const ficha = await ejs.renderFile(path.join(__dirname, '..', 'views', 'gestao', 'assistido.ejs'), { ...base, assistido: { _id: cpf, nome_assistido: 'Assistido', status: 'Ativo' }, historico: [{ tipo: 'apometria', data: new Date(), data_retorno: '2026-12-01' }] });
    assert.ok(ficha.includes(op.formatarData('2026-12-01')));
    const configuracoes = await ejs.renderFile(path.join(__dirname, '..', 'views', 'gestao', 'configuracoes.ejs'), { ...base, configuracoes: [], dias: op.DIAS });
    for (const html of [apometria, ficha, configuracoes]) assert.equal(/plano de acompanhamento|\/acompanhamentos/i.test(html), false);
});

test('busca de beneficiário funciona sem seleção e permite reutilizar cadastro por botão', async () => {
    const fs = require('node:fs');
    const vm = require('node:vm');
    function elemento() {
        return { value: '', textContent: '', children: [], eventos: {},
            addEventListener(tipo, fn) { this.eventos[tipo] = fn; },
            replaceChildren() { this.children = []; },
            appendChild(child) { this.children.push(child); },
            querySelectorAll() { return []; } };
    }
    const campos = Object.fromEntries(['para_terceiro', 'dados_beneficiario', 'beneficiario_nome', 'beneficiario_cpf', 'beneficiario_id', 'resultados_beneficiario', 'feedback_beneficiario', 'buscar_beneficiario'].map(id => [id, elemento()]));
    let pessoas = [];
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'apometriaBeneficiario.js'), 'utf8'), {
        document: { getElementById: id => campos[id], createElement: elemento },
        fetch: async () => ({ ok: true, json: async () => pessoas })
    });
    campos.beneficiario_nome.value = 'Pessoa';
    const buscar = () => campos.buscar_beneficiario.eventos.click.call(campos.buscar_beneficiario);
    await buscar();
    assert.equal(campos.feedback_beneficiario.textContent, 'Nenhum cadastro encontrado. O assistido será identificado pelo nome informado.');
    assert.equal(campos.resultados_beneficiario.children.length, 0);
    pessoas = [{ id: 'pessoa-id', nome: 'Pessoa cadastrada', cpf: '12345678906' }];
    await buscar();
    const botao = campos.resultados_beneficiario.children[0];
    assert.equal(botao.type, 'button');
    botao.eventos.click();
    assert.equal(campos.beneficiario_id.value, 'pessoa-id');
    assert.equal(campos.beneficiario_nome.value, 'Pessoa cadastrada');
    assert.equal(campos.beneficiario_cpf.value, '12345678906');
    campos.beneficiario_nome.eventos.input();
    assert.equal(campos.beneficiario_id.value, '');
    assert.equal(campos.resultados_beneficiario.children.length, 0);
});
