(function (raiz, criar) {
    if (typeof module === 'object' && module.exports) module.exports = criar();
    else raiz.CasinhaDatas = criar();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    // O sinal de Etc/GMT é invertido: Etc/GMT+3 representa UTC-03:00 fixo.
    const FUSO = 'Etc/GMT+3';
    function dataValida(valor) {
        if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
        const data = new Date(`${valor}T12:00:00Z`);
        return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
    }
    function instante(valor) {
        if (typeof valor === 'string' && dataValida(valor)) return inicioDia(valor);
        // Datas com hora sem indicação de fuso são horários locais da operação.
        if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(valor)) return new Date(`${valor}-03:00`);
        return new Date(valor);
    }
    function dataISO(valor = new Date()) {
        return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(instante(valor));
    }
    function hojeLocal(agora = new Date()) { return dataISO(agora); }
    function inicioDia(valor) { return new Date(`${valor}T00:00:00-03:00`); }
    function fimDia(valor) { return new Date(`${valor}T23:59:59.999-03:00`); }
    function somarDiasISO(valor, dias) {
        const data = new Date(`${valor}T12:00:00Z`);
        data.setUTCDate(data.getUTCDate() + dias);
        return data.toISOString().slice(0, 10);
    }
    function inicioMes(agora = new Date()) { return inicioDia(`${dataISO(agora).slice(0, 7)}-01`); }
    function diaSemana(valor) { return new Date(`${valor}T12:00:00Z`).getUTCDay(); }
    function formatar(valor, opcoes) {
        if (valor === undefined || valor === null || valor === '') return '—';
        const data = instante(valor);
        if (Number.isNaN(data.getTime())) return '—';
        return new Intl.DateTimeFormat('pt-BR', { ...opcoes, timeZone: FUSO }).format(data);
    }
    function formatarData(valor) { return formatar(valor, { day: '2-digit', month: '2-digit', year: 'numeric' }); }
    function formatarHora(valor) { return formatar(valor, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); }
    function formatarDataHora(valor) { return formatar(valor, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); }
    // Nascimento é data civil. Cadastros legados usam meia-noite UTC;
    // conservar o dia registrado evita deslocá-lo para o dia anterior.
    function dataNascimentoISO(valor) {
        if (!valor) return '';
        const data = valor instanceof Date ? valor.toISOString().slice(0, 10) : String(valor).slice(0, 10);
        return dataValida(data) ? data : '';
    }
    function calcularIdade(valor, referencia = hojeLocal()) {
        const nascimento = dataNascimentoISO(valor);
        if (!nascimento || nascimento > referencia) return '';
        return Number(referencia.slice(0, 4)) - Number(nascimento.slice(0, 4)) - (referencia.slice(5) < nascimento.slice(5) ? 1 : 0);
    }
    return { FUSO, dataValida, instante, dataISO, hojeLocal, inicioDia, fimDia, somarDiasISO, inicioMes, diaSemana, formatarData, formatarHora, formatarDataHora, dataNascimentoISO, calcularIdade };
});
