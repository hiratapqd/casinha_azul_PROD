const MODALIDADES = [
    { id: 'apometria', nome: 'Apometria', slug: 'apometrico', disponibilidade: 'apometria' },
    { id: 'reiki', nome: 'Reiki', slug: 'reiki', disponibilidade: 'reiki' },
    { id: 'auriculo', nome: 'Aurículo', slug: 'auriculo', disponibilidade: 'auriculo' },
    { id: 'maos_sem_fronteiras', nome: 'Mãos sem Fronteiras', slug: 'maos_sem_fronteiras', disponibilidade: 'maos' },
    { id: 'homeopatia', nome: 'Homeopatia', slug: 'homeopatico', disponibilidade: 'homeopatia' },
    { id: 'passe', nome: 'Passe', slug: 'passe', disponibilidade: 'passe' },
    { id: 'gappus', nome: 'GAPPUS', slug: 'gappus', disponibilidade: 'gappus', grupo: true }
];
const DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
const DIAS_ABREV = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const datas = require('../../public/dataHora');
const { hojeLocal, dataValida, inicioDia, fimDia, diaSemana, formatarData } = datas;
function entradaInvalida(mensagem) { const e = new Error(mensagem); e.status = 400; throw e; }
function inteiro(valor, minimo = 0, maximo = 10000) {
    if (valor === '' || valor === undefined || valor === null || !/^\d+$/.test(String(valor))) entradaInvalida('Informe um número inteiro válido.');
    const numero = Number(valor);
    if (!Number.isSafeInteger(numero) || numero < minimo || numero > maximo) entradaInvalida(`Informe um valor entre ${minimo} e ${maximo}.`);
    return numero;
}
function texto(valor, maximo = 2000) {
    if (valor !== undefined && typeof valor !== 'string') entradaInvalida('Informe um texto válido.');
    const resultado = (valor || '').trim();
    if (resultado.length > maximo) entradaInvalida(`O texto deve ter até ${maximo} caracteres.`);
    return resultado;
}
function escapeRegex(valor) { return valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function reservasEscala(escala) {
    if (escala.status !== 'Confirmado') return undefined;
    const minutos = hora => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3));
    const inicio = minutos(escala.inicio), fim = minutos(escala.fim);
    return Array.from({ length: fim - inicio }, (_, i) => `${escala.data}_${escala.cpf_substituto || escala.cpf_voluntario}_${inicio + i}`);
}
module.exports = { ...datas, MODALIDADES, DIAS, DIAS_ABREV, inteiro, texto, escapeRegex, reservasEscala };
