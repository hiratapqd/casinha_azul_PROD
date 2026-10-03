const test = require('node:test');
const assert = require('node:assert/strict');
const ejs = require('ejs');
const path = require('node:path');
const { resumirFaltasGappus } = require('../src/services/FaltasGappus');
const controller = require('../src/controllers/GappusController');
const Encontro = require('../src/models/EncontroGappus');
const Participante = require('../src/models/ParticipanteGappus');
const Atendimento = require('../src/models/Atendimento');
const Assistido = require('../src/models/Assistido');
const op = require('../src/utils/operacao');
const id = '507f1f77bcf86cd799439011', cpf = '12345678906';
const consulta = dados => ({ sort() { return this; }, lean: async () => dados });
const cadastro = (pessoas, encaminhamentos = []) => ({ pessoas: new Map(pessoas.map(p => [p.id, p])), encaminhamentos });
const pessoa = (mais = {}) => ({ id, nome: 'Participante', papel: 'Familiar', inclusao_manual: true, data_inicio: '2026-09-01', ...mais });
const encontro = (data, participantes = []) => ({ _id: data, participantes });
const inicio = '2026-09-04', fim = '2026-10-03';
function resposta() { return { codigo: 200, status(c) { this.codigo = c; return this; }, render(tela, dados) { this.tela = tela; this.dados = dados; } }; }

test('faltas cobrem exatamente 30 dias inclusive e somente encontros salvos', () => {
    const encontros = [encontro('2026-09-03'), encontro(inicio), encontro('2026-09-20', [{ participante_id: id, nome: 'Participante' }]), encontro(fim), encontro('2026-10-04')];
    const resumo = resumirFaltasGappus(encontros, cadastro([pessoa()]), inicio, fim);
    assert.equal(resumo.encontrosRealizados, 3);
    assert.equal(resumo.faltantes.length, 1);
    assert.deepEqual(resumo.faltantes[0].datasFaltas, [inicio, fim]);
    assert.equal(resumo.faltantes[0].presencas, 1); assert.equal(resumo.faltantes[0].encontrosPrevistos, 3);
    assert.equal(resumirFaltasGappus([], cadastro([pessoa()]), inicio, fim).faltantes.length, 0);
});
test('inclusão, desistência e retomada delimitam as datas de faltas', () => {
    const encontros = [encontro('2026-09-04'), encontro('2026-09-10'), encontro('2026-09-20'), encontro(fim)];
    const entrada = resumirFaltasGappus(encontros, cadastro([pessoa({ data_inicio: '2026-09-10' })]), inicio, fim);
    assert.deepEqual(entrada.faltantes[0].datasFaltas, ['2026-09-10', '2026-09-20', fim]);
    const desistencia = resumirFaltasGappus(encontros, cadastro([pessoa({ status: 'Desistiu', desistencia_em: op.inicioDia('2026-09-20') })]), inicio, fim);
    assert.deepEqual(desistencia.faltantes[0].datasFaltas, [inicio, '2026-09-10']);
    const retomada = resumirFaltasGappus(encontros, cadastro([pessoa({ status: 'Ativo', data_inicio: fim })], [
        { cpf_assistido: id, data: op.inicioDia(inicio), gappus_indicado: true }
    ]), inicio, fim);
    assert.deepEqual(retomada.faltantes[0].datasFaltas, [fim]);
});
test('indicação na apometria inclui atendido e beneficiado e considera indicação posterior', () => {
    const pai = pessoa({ id: cpf, cpf, papel: 'Atendido', inclusao_manual: false });
    const filho = pessoa({ inclusao_manual: false, papel: 'Assistido' });
    const encaminhamentos = [
        { cpf_assistido: cpf, data: op.inicioDia('2026-09-10'), gappus_indicado: true, beneficiario: { participante_id: id } },
        { cpf_assistido: cpf, data: op.inicioDia(fim), gappus_indicado: false }
    ];
    const resumo = resumirFaltasGappus([encontro(inicio), encontro('2026-09-20'), encontro(fim)], cadastro([pai, filho], encaminhamentos), inicio, fim);
    assert.equal(resumo.faltantes.length, 2);
    for (const p of resumo.faltantes) assert.deepEqual(p.datasFaltas, ['2026-09-20']);
});
test('CPF legado e identificador atual representam uma presença e pessoas sem CPF ficam separadas', () => {
    const atual = pessoa({ cpf });
    const legado = pessoa({ id: cpf, cpf, inclusao_manual: false });
    const outro = pessoa({ id: '507f1f77bcf86cd799439012', nome: 'Participante' });
    const resumo = resumirFaltasGappus([encontro(inicio, [{ cpf, nome: atual.nome }]), encontro(fim)], cadastro([legado, atual, outro], [
        { cpf_assistido: cpf, data: op.inicioDia(inicio), gappus_indicado: true }
    ]), inicio, fim);
    const primeiro = resumo.faltantes.find(p => p.id === id);
    assert.equal(primeiro.presencas, 1); assert.deepEqual(primeiro.datasFaltas, [fim]);
    assert.equal(resumo.faltantes.find(p => p.id === outro.id).datasFaltas.length, 2);
    const desistiu = resumirFaltasGappus([encontro(inicio), encontro(fim)], cadastro([
        legado, { ...atual, status: 'Desistiu', desistencia_em: op.inicioDia(fim) }
    ], [{ cpf_assistido: cpf, data: op.inicioDia(inicio), gappus_indicado: true }]), inicio, fim);
    assert.deepEqual(desistiu.faltantes[0].datasFaltas, [inicio]);
});
test('controle consulta o intervalo correto e permite busca por CPF ou nome', async t => {
    const hoje = op.hojeLocal(), comeco = op.somarDiasISO(hoje, -29);
    t.mock.method(Encontro, 'find', filtro => { assert.deepEqual(filtro, { _id: { $lte: hoje } }); return consulta([encontro(comeco), encontro(hoje)]); });
    t.mock.method(Participante, 'find', () => consulta([pessoa({ _id: id, cpf, data_inicio: comeco })]));
    t.mock.method(Atendimento, 'find', () => consulta([]));
    t.mock.method(Assistido, 'find', () => consulta([]));
    for (const busca of ['', 'Participante', '123.456.789-06']) {
        const res = resposta(); await controller.relatorioFaltas({ query: { busca } }, res);
        assert.equal(res.codigo, 200); assert.equal(res.dados.inicio, comeco); assert.equal(res.dados.fim, hoje);
        assert.equal(res.dados.faltantes.length, 1); assert.equal(res.dados.totalFaltas, 2);
    }
    const vazio = resposta(); await controller.relatorioFaltas({ query: { busca: 'Inexistente' } }, vazio);
    assert.equal(vazio.dados.faltantes.length, 0);
});

test('participante antigo sem inclusão manual recebe as quatro faltas mesmo com indicação posterior', () => {
    const cpfAntigo = '12345678903';
    const antigo = pessoa({ id: cpfAntigo, cpf: cpfAntigo, nome: 'assistido exemplo 3', inclusao_manual: false });
    const datasFaltas = ['2026-09-11', '2026-09-18', '2026-09-25', '2026-10-02'];
    const encontros = [encontro('2026-06-05'),
        encontro('2026-06-12', [{ cpf: cpfAntigo, nome: antigo.nome }]),
        encontro(inicio, [{ cpf: cpfAntigo, nome: antigo.nome }]), ...datasFaltas.map(data => encontro(data))];
    const resumo = resumirFaltasGappus(encontros, cadastro([antigo], [
        { cpf_assistido: cpfAntigo, data: op.inicioDia(fim), gappus_indicado: true }
    ]), inicio, fim);
    assert.equal(resumo.encontrosRealizados, 5);
    assert.equal(resumo.faltantes.length, 1);
    assert.deepEqual(resumo.faltantes[0].datasFaltas, datasFaltas);
    assert.equal(resumo.faltantes[0].presencas, 1);
});

test('listas antigas identificam pessoas sem CPF sem atribuir faltas antes da primeira presença', () => {
    const historico = [encontro(inicio), encontro('2026-09-11', [{ participante_id: id, nome: 'Pessoa antiga', papel: 'Familiar' }]), encontro('2026-09-18')];
    const resumo = resumirFaltasGappus(historico, cadastro([]), inicio, fim);
    assert.equal(resumo.faltantes.length, 1);
    assert.equal(resumo.faltantes[0].nome, 'Pessoa antiga');
    assert.deepEqual(resumo.faltantes[0].datasFaltas, ['2026-09-18']);
    assert.equal(resumo.faltantes[0].presencas, 1);
});
test('datas inválidas e futuras são rejeitadas antes de consultar o banco', async t => {
    const consultar = t.mock.method(Encontro, 'find', () => consulta([]));
    for (const data of ['2026-02-30', op.somarDiasISO(op.hojeLocal(), 1)]) {
        const res = resposta(); await controller.relatorioFaltas({ query: { data } }, res);
        assert.equal(res.codigo, 400);
    }
    assert.equal(consultar.mock.callCount(), 0);
});
test('relatório renderiza faltas, links e nomes escapados', async () => {
    const dados = resumirFaltasGappus([encontro(inicio)], cadastro([pessoa({ nome: '<script>nome</script>' })]), inicio, fim);
    const base = { inicio, fim, hoje: fim, busca: '', encontrosRealizados: dados.encontrosRealizados, faltantes: dados.faltantes, totalFaltas: 1, formatarData: op.formatarData };
    const renderizar = dados => ejs.renderFile(path.join(__dirname, '..', 'views', 'gestao', 'gappus_faltas.ejs'), dados);
    const html = await renderizar(base);
    assert.ok(html.includes('&lt;script&gt;nome&lt;/script&gt;')); assert.ok(html.includes(`/atendimento/gappus?data=${inicio}`));
    assert.ok(html.includes(`/gappus/participantes/${id}`));
    const vazio = await renderizar({ ...base, encontrosRealizados: 0, faltantes: [], totalFaltas: 0 });
    assert.ok(vazio.includes('Nenhum encontro com lista de presença salva neste período.'));
});
