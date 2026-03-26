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
    // Usamos a função de fuso horário que você já tem para garantir a data correta do Brasil
    const hojeBrasilia = getDataBrasilia(); 
    
    const hojeAbrev = hojeBrasilia.toLocaleDateString('pt-BR', { weekday: 'short' })
                                .toLowerCase()
                                .replace('.', '') 
                                .substring(0, 3); 

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
        const [atendimentosPorTipoDB] = await Promise.all([
            Atendimento.aggregate([
                {
                    $match: {
                        data: { $gte: hojeInicio, $lte: hojeFim }
                    }
                },
                {
                    $group: {
                        _id: "$tipo",
                        total: { $sum: 1 }
                    }
                }
            ]),
            Voluntario.find({ esta_ativo: { $ne: "Não" } }).lean()
        ]);

        const atendimentosHoje = {
            apometria: await Atendimento.countDocuments({ data: { $gte: hojeInicio, $lte: hojeFim }, tipo: 'apometria' }),
            reiki: await Atendimento.countDocuments({ data: { $gte: hojeInicio, $lte: hojeFim }, tipo: 'reiki' }),
            auriculo: await Atendimento.countDocuments({ data: { $gte: hojeInicio, $lte: hojeFim }, tipo: 'auriculo' }),
            maos: await Atendimento.countDocuments({ data: { $gte: hojeInicio, $lte: hojeFim }, tipo: 'maos_sem_fronteiras' }),
            homeopatia: await Atendimento.countDocuments({ data: { $gte: hojeInicio, $lte: hojeFim }, tipo: 'homeopatia' }),
            passe: await Atendimento.countDocuments({ data: { $gte: hojeInicio, $lte: hojeFim }, tipo: 'passe' })
        };
                atendimentosPorTipoDB.forEach(item => {
            if (atendimentosHoje.hasOwnProperty(item._id)) {
                atendimentosHoje[item._id] = item.total;
            }
        });
        // 2. Lógica de Taxa de Abandono (AJUSTADO PARA 'tipoAtendimento' e 'Apometria')

/*         // 2.1. Pegar todos os CPFs únicos que já fizeram Apometria em qualquer tempo
        const todosQueFizeramApometria = await Atendimento.distinct("cpf_assistido", { tipo: "apometria" });

        // 2.2. Pegar todos os CPFs que já fizeram QUALQUER OUTRO tipo de atendimento (Reiki, Passe, etc)
        const todosQueFizeramOutros = await Atendimento.distinct("cpf_assistido", { 
            tipo: { $ne: "apometria" } 
        });

        const setOutros = new Set(todosQueFizeramOutros.map(cpf => String(cpf)));

        // 2.3. Abandono = Quem está na lista da Apometria mas NÃO está na lista de Outros
        const abandonosReais = todosQueFizeramApometria.filter(cpf => !setOutros.has(String(cpf)));

        // 2.4. Cálculo da Taxa
        // Total de pessoas que passaram pela Apometria (base do cálculo)
        const totalBaseApometria = todosQueFizeramApometria.length;

        const taxaAbandono = totalBaseApometria > 0 
            ? ((abandonosReais.length / totalBaseApometria) * 100).toFixed(1) 
            : 0; */
        // --- 2. CÁLCULO DE ABANDONO (Baseado em quem não volta mais) ---
        const trintaDiasAtras = new Date(getDataBrasilia());
        trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

        // Pegamos a última vez que cada pessoa esteve na casa (Apometria ou Passe)
        const presencasRecentes = await Atendimento.aggregate([
            { $match: { tipo: { $in: ['apometria', 'passe'] } } },
            { $group: {
                _id: "$cpf_assistido",
                ultimaVez: { $max: "$data" }
            }}
        ]);

        // 1. Quem veio nos últimos 30 dias (Ativos)
        const ativos = presencasRecentes.filter(p => p.ultimaVez >= trintaDiasAtras).map(p => p._id);
        const setAtivos = new Set(ativos);

        // 2. Todos que já fizeram Apometria na história
        const todosApometria = await Atendimento.distinct('cpf_assistido', { tipo: 'apometria' });

        // 3. Abandonos = Pessoas da Apometria que NÃO estão no set de ativos
        const abandonosReais = todosApometria.filter(cpf => !setAtivos.has(cpf));

        const totalBase = todosApometria.length;
        const taxaAbandono = totalBase > 0 
            ? ((abandonosReais.length / totalBase) * 100).toFixed(1) 
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
                detalheAtendimentos: atendimentosHoje,
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
