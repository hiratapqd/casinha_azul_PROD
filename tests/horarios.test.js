const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const datas = require('../public/dataHora');
const Atendimento = require('../src/models/Atendimento');
const Livro = require('../src/models/Livro');
const Venda = require('../src/models/Venda');
const Assistido = require('../src/models/Assistido');
const relatorios = require('../src/controllers/RelatorioController');
const livraria = require('../src/controllers/LivrariaController');
const assistidos = require('../src/controllers/AssistidoController');
function consulta(dados) { return { sort() { return this; }, lean: async () => dados }; }
function resposta() {
    return { status() { return this; }, render(tela, dados) { this.dados = dados; }, redirect(url) { this.url = url; }, json(dados) { this.dados = dados; } };
}

test('dia operacional muda às 03:00 UTC, incluindo virada de mês e de ano', () => {
    assert.equal(datas.hojeLocal('2026-10-02T02:59:59.999Z'), '2026-10-01');
    assert.equal(datas.hojeLocal('2026-10-02T03:00:00.000Z'), '2026-10-02');
    assert.equal(datas.hojeLocal('2026-01-01T02:30:00Z'), '2025-12-31');
    assert.equal(datas.inicioMes('2026-10-01T02:30:00Z').toISOString(), '2026-09-01T03:00:00.000Z');
    assert.equal(datas.inicioMes('2026-10-01T03:00:00Z').toISOString(), '2026-10-01T03:00:00.000Z');
});
test('limites do dia e aritmética de calendário incluem o último milissegundo', () => {
    assert.equal(datas.inicioDia('2026-10-02').toISOString(), '2026-10-02T03:00:00.000Z');
    assert.equal(datas.fimDia('2026-10-02').toISOString(), '2026-10-03T02:59:59.999Z');
    assert.equal(datas.somarDiasISO('2024-03-01', -1), '2024-02-29');
    assert.equal(datas.somarDiasISO('2026-01-01', -1), '2025-12-31');
    assert.equal(datas.diaSemana('2026-10-02'), 5);
});
test('hora é GMT-3 fixo inclusive em datas históricas, sem deslocar o instante', () => {
    const instante = new Date('2018-12-01T03:00:00Z');
    const original = instante.getTime();
    assert.equal(datas.formatarHora(instante), '00:00');
    assert.equal(datas.formatarHora('2026-10-02T02:59:00Z'), '23:59');
    assert.equal(datas.formatarData('2026-10-02T02:59:00Z'), '01/10/2026');
    assert.equal(instante.getTime(), original);
});
test('hora sem offset é interpretada como horário da operação e data civil conserva o dia', () => {
    assert.equal(datas.instante('2026-10-02T09:30:00').toISOString(), '2026-10-02T12:30:00.000Z');
    assert.equal(datas.formatarData('2026-10-02'), '02/10/2026');
    assert.equal(datas.formatarData('inválida'), '—');
});
test('nascimento legado e novo mantêm o mesmo dia e a idade muda no aniversário em GMT-3', () => {
    assert.equal(datas.dataNascimentoISO(new Date('2000-10-02T00:00:00Z')), '2000-10-02');
    assert.equal(datas.dataNascimentoISO(new Date('2000-10-02T03:00:00Z')), '2000-10-02');
    assert.equal(datas.calcularIdade('2000-10-02', datas.hojeLocal('2026-10-02T02:59:59Z')), 25);
    assert.equal(datas.calcularIdade('2000-10-02', datas.hojeLocal('2026-10-02T03:00:00Z')), 26);
});
test('resultado independe do fuso do computador', t => {
    const anterior = process.env.TZ;
    t.after(() => { if (anterior === undefined) delete process.env.TZ; else process.env.TZ = anterior; });
    for (const fuso of ['UTC', 'Asia/Tokyo', 'America/Los_Angeles']) {
        process.env.TZ = fuso;
        assert.equal(datas.hojeLocal('2026-10-02T02:30:00Z'), '2026-10-01');
        assert.equal(datas.formatarHora('2026-10-02T02:30:00Z'), '23:30');
        assert.equal(datas.inicioMes('2026-10-01T02:30:00Z').toISOString(), '2026-09-01T03:00:00.000Z');
    }
});
test('navegador usa a mesma regra de data e horário do servidor', () => {
    const contexto = vm.createContext({ Intl, Date });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'dataHora.js'), 'utf8'), contexto);
    assert.equal(contexto.CasinhaDatas.hojeLocal('2026-10-02T02:30:00Z'), datas.hojeLocal('2026-10-02T02:30:00Z'));
    assert.equal(contexto.CasinhaDatas.formatarHora('2026-10-02T12:00:00Z'), '09:00');
});
test('relatório de hoje às 23:59 GMT-3 filtra o dia local, e não o dia UTC', async t => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-02T02:59:59.999Z') });
    let filtro;
    t.mock.method(Atendimento, 'find', f => { filtro = f; return consulta([]); });
    const res = resposta(); await relatorios.getAtendimentosHoje({}, res);
    assert.equal(filtro.data.$gte.toISOString(), '2026-10-01T03:00:00.000Z');
    assert.equal(filtro.data.$lte.toISOString(), '2026-10-02T02:59:59.999Z');
    assert.equal(res.dados.hoje, '01/10/2026');
});
test('resumo mensal da livraria respeita o começo do mês em GMT-3', async t => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-01T03:30:00Z') });
    t.mock.method(Livro, 'find', () => consulta([{ _id: 'isbn', titulo: 'Livro', estoque_atual: 2 }]));
    t.mock.method(Venda, 'find', () => consulta([
        { livro_id: 'isbn', data_venda: new Date('2026-10-01T02:59:59Z'), quantidade: 1, valor_total: 10 },
        { livro_id: 'isbn', data_venda: new Date('2026-10-01T03:00:00Z'), quantidade: 1, valor_total: 20 }
    ]));
    const res = resposta(); await livraria.getEstoque({}, res);
    assert.equal(res.dados.totalVendidoMes, 20);
});
test('cadastro do livro grava o instante correto sem subtrair três horas', async t => {
    const agora = Date.parse('2026-10-02T12:30:00Z');
    t.mock.timers.enable({ apis: ['Date'], now: agora });
    let livro;
    t.mock.method(Livro.prototype, 'save', async function () { livro = this; });
    await livraria.salvarLivro({ body: { isbn: '123', titulo: 'Livro', estoque_inicial: '2' } }, resposta());
    assert.equal(livro.data_cadastro.getTime(), agora);
});
test('cadastro do assistido conserva instante do registro e nascimento como data civil', async t => {
    const agora = Date.parse('2026-10-02T02:30:00Z');
    t.mock.timers.enable({ apis: ['Date'], now: agora });
    t.mock.method(Assistido, 'findById', async () => null);
    let assistido;
    t.mock.method(Assistido.prototype, 'save', async function () { assistido = this; });
    await assistidos.criarAssistido({ body: { cpf_assistido: '12345678906', nome_assistido: 'Assistido', data_nascimento_assistido: '2000-10-02' } }, resposta());
    assert.equal(assistido.dataCadastro.getTime(), agora);
    assert.equal(assistido.data_nascimento_assistido.toISOString(), '2000-10-02T03:00:00.000Z');
});
