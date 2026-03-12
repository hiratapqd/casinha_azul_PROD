const Atendimento = require('../models/Atendimento');
const Voluntario = require('../models/Voluntario');

// --- FUNÇÃO AUXILIAR: PROCESSAR EQUIPE ATIVA ---
const calcularEquipeAtiva = (voluntarios, mapa) => {
    const contagemResumo = {};
    Object.keys(mapa).forEach(label => {
        const chaves = mapa[label];
        const encontrados = voluntarios.filter(v => {
            const disp = v.disponibilidade || {};
            return chaves.some(chave => {
                const campo = disp[chave];
                return (Array.isArray(campo) && campo.length > 0) || 
                       (typeof campo === 'string' && campo.trim() !== "");
            });
        });
        contagemResumo[label] = encontrados.length;
    });
    return contagemResumo;
};

// --- FUNÇÃO AUXILIAR: PROCESSAR ESCALA DO DIA ---
const calcularEscalaHoje = (voluntarios, mapa) => {
    const diasRef = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
    const hojeAbrev = diasRef[new Date().getDay()];
    const escala = [];

    voluntarios.forEach(v => {
        const disp = v.disponibilidade || {};
        Object.entries(mapa).forEach(([label, chaves]) => {
            let escaladoNestaCategoria = false;
            chaves.forEach(chave => {
                const dados = disp[chave];
                if (!dados) return;

                let lista = Array.isArray(dados) ? dados : [dados];
                let listaLimpa = lista.map(d => 
                    String(d).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
                );

                if (listaLimpa.includes(hojeAbrev)) escaladoNestaCategoria = true;
            });

            if (escaladoNestaCategoria) {
                escala.push({ nome: v.nome, tipo: label });
            }
        });
    });
    return escala;
};

exports.getDashboard = async (req, res) => {
    try {
        const hojeInicio = new Date();
        hojeInicio.setHours(0, 0, 0, 0);
        const hojeFim = new Date();
        hojeFim.setHours(23, 59, 59, 999);

        // Busca dados em paralelo para performance 
        const [totalAtendimentosHoje, voluntariosDB] = await Promise.all([
            Atendimento.countDocuments({ data: { $gte: hojeInicio, $lte: hojeFim } }),
            Voluntario.find({ esta_ativo: { $ne: "Não" } }).lean()
        ]);

        // Mapa corrigido com "apometrico" e "homeopatico" 
        const mapaGeral = {
            "Apometria": ["apometrico"],
            "Reiki": ["reiki"],
            "Aurículo": ["auriculo"],
            "Mãos sem Fronteiras": ["maos"],
            "Homeopatia": ["homeopatico"],
            "Passe": ["passe"],
            "Cantina": ["cantina"],
            "Mesa": ["mesa"]
        };

        // Agora as variáveis são definidas corretamente 
        const voluntariosPorTipo = calcularEquipeAtiva(voluntariosDB, mapaGeral);
        const escala_hoje = calcularEscalaHoje(voluntariosDB, mapaGeral);

        res.render('index', {
            resumo: {
                hoje: totalAtendimentosHoje,
                taxaAbandono: 33.3, 
                apometriaUnica: 0, 
                voluntariosPorTipo, // Enviando para o index.ejs 
                totalVoluntarios: voluntariosDB.length
            },
            escala_hoje // Enviando para o index.ejs 
        });

    } catch (err) {
        console.error("❌ Erro no DashboardController:", err);
        res.status(500).send("Erro ao carregar o painel.");
    }
};