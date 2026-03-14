const Atendimento = require('../models/Atendimento');
const Voluntario = require('../models/Voluntario');

// --- FUNÇÃO AUXILIAR PARA PEGAR DATA EM GMT-3 ---
const getDataBrasilia = () => {
    const agora = new Date();
    const brasiliaTime = new Date(agora.getTime() - (3 * 60 * 60 * 1000));
    return brasiliaTime;
};

// --- FUNÇÕES AUXILIARES DE CÁLCULO ---
const calcularEquipeAtiva = (voluntarios, mapa) => {
    const contagemResumo = {};
    Object.keys(mapa).forEach(label => {
        const chaves = mapa[label];
        const encontrados = voluntarios.filter(v => {
            const disp = v.disponibilidade || {};
            return chaves.some(chave => {
                const campo = disp[chave];
                return (Array.isArray(campo) && campo.length > 0);
            });
        });
        contagemResumo[label] = encontrados.length;
    });
    return contagemResumo;
};

const calcularEscalaHoje = (voluntarios, mapa) => {
    const diasRef = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
    const hojeBrasilia = getDataBrasilia();
    const hojeAbrev = diasRef[hojeBrasilia.getUTCDay()];
    
    const escala = [];
    voluntarios.forEach(v => {
        const disp = v.disponibilidade || {};
        Object.entries(mapa).forEach(([label, chaves]) => {
            chaves.forEach(chave => {
                const diasMarcados = disp[chave] || [];
                if (Array.isArray(diasMarcados) && diasMarcados.includes(hojeAbrev)) {
                    escala.push({ nome: v.nome, tipo: label });
                }
            });
        });
    });
    return escala;
};

exports.getDashboard = async (req, res) => {
    try {
        const hojeBrasilia = getDataBrasilia();
        
        const hojeInicio = new Date(hojeBrasilia);
        hojeInicio.setUTCHours(0, 0, 0, 0);
        
        const hojeFim = new Date(hojeBrasilia);
        hojeFim.setUTCHours(23, 59, 59, 999);

        const limite14Dias = new Date(hojeBrasilia);
        limite14Dias.setUTCDate(limite14Dias.getUTCDate() - 14);

        // 1. Buscas no Banco (Campo 'data' conforme o print)
        const [totalAtendimentosHoje, voluntariosDB] = await Promise.all([
            Atendimento.countDocuments({ data: { $gte: hojeInicio, $lte: hojeFim } }),
            Voluntario.find({ esta_ativo: { $ne: "Não" } }).lean()
        ]);

        // 2. Lógica de Taxa de Abandono (AJUSTADO PARA 'tipoAtendimento' e 'Apometria')
        // Passo A: CPFs com Apometria antiga (> 14 dias)
        const fizeramApometriaAntiga = await Atendimento.distinct("cpf_assistido", {
            tipo: "apometrico", // Ajustado para bater com seu print
            data: { $lt: limite14Dias }
        });

        // Passo B: CPFs com QUALQUER outro tratamento (diferente de Apometria)
        const fizeramOutros = await Atendimento.distinct("cpf_assistido", {
            tipo: { $ne: "apometrico" } // Ajustado aqui também
        });

        const setOutros = new Set(fizeramOutros.map(cpf => String(cpf)));

        // Passo C: Abandono = Fez apometria antiga mas nunca apareceu em outros
        const abandonosReais = fizeramApometriaAntiga.filter(cpf => !setOutros.has(String(cpf)));
        
        const assistidosUnicos = await Atendimento.distinct("cpf_assistido");
        const taxaAbandono = assistidosUnicos.length > 0 
            ? ((abandonosReais.length / assistidosUnicos.length) * 100).toFixed(1) 
            : 0;

        // 3. Mapeamento Geral
        const mapaGeral = {
            "Apometria": ["apometria"],
            "Reiki": ["reiki"],
            "Aurículo": ["auriculo"],
            "Mãos sem Fronteiras": ["maos"],
            "Homeopatia": ["homeopatia"],
            "Passe": ["passe"],
            "Cantina": ["cantina"],
            "Mesa": ["mesa"]
        };

        const voluntariosPorTipo = calcularEquipeAtiva(voluntariosDB, mapaGeral);
        const escala_hoje = calcularEscalaHoje(voluntariosDB, mapaGeral);

        res.render('index', {
            resumo: {
                hoje: totalAtendimentosHoje,
                taxaAbandono: taxaAbandono, 
                apometriaUnica: abandonosReais.length, 
                voluntariosPorTipo,
                totalVoluntarios: voluntariosDB.length
            },
            escala_hoje
        });

    } catch (err) {
        console.error("Erro no Dashboard:", err);
        res.status(500).send("Erro ao carregar dashboard.");
    }
};