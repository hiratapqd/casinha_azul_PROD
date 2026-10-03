const Atendimento = require('../models/Atendimento');
const Voluntario = require('../models/Voluntario');
const EscalaData = require('../models/EscalaData');
const EncontroGappus = require('../models/EncontroGappus');
const { resumirAbandonoApometria } = require('../services/AcompanhamentosHistoricos');
const { hojeLocal, inicioDia, fimDia, diaSemana, DIAS_ABREV, MODALIDADES } = require('../utils/operacao');

function formatarPercentualTruncado(valor, total) {
    if (!total) return '0.00';

    const percentual = (valor / total) * 100;
    return (Math.floor(percentual * 100) / 100).toFixed(2);
}

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
    const hojeAbrev = DIAS_ABREV[diaSemana(hojeLocal())];

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

const calcularAbandonoApometria = async () => {
    const encontrosGappus = await EncontroGappus.find().lean();
    const historico = await Atendimento.find(
        { cpf_assistido: { $exists: true, $nin: [null, ''] } },
        { cpf_assistido: 1, tipo: 1, data: 1 }
    ).lean();

    const { totalBase, candidatos } = resumirAbandonoApometria(historico, encontrosGappus);
    const totalAbandonos = candidatos.length;

    return {
        totalBase,
        totalAbandonos,
        taxaAbandono: formatarPercentualTruncado(totalAbandonos, totalBase)
    };
};

exports.getDashboard = async (req, res) => {
    try {
        const hojeInicio = inicioDia(hojeLocal());
        
        const hojeFim = fimDia(hojeLocal());

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
        // Taxa de abandono: assistidos com apometria + passe e nenhum retorno posterior.
        const abandonoApometria = await calcularAbandonoApometria();

        // 3. Mapeamento Geral
        const mapaGeral = {
            "Apometria": ["apometria"],
            "Reiki": ["reiki"],
            "Aurículo": ["auriculo"],
            "Mãos sem Fronteiras": ["maos"],
            "Homeopatia": ["homeopatia"],
            "Passe": ["passe"],
            "GAPPUS": ["gappus"],
            "Cantina": ["cantina"],
            "Mesa": ["mesa"]
        };

        const voluntariosPorTipo = calcularEquipeAtiva(voluntariosDB, mapaGeral);
        const escalasData = await EscalaData.find({ data: hojeLocal() }).lean();
        let escala_hoje = calcularEscalaHoje(voluntariosDB, mapaGeral);
        if (escalasData.length) {
            const cpfs = escalasData.map(e => e.cpf_substituto || e.cpf_voluntario);
            const escalados = await Voluntario.find({ _id: { $in: cpfs } }).lean();
            const nomes = new Map(escalados.map(v => [v._id, v.nome]));
            escala_hoje = escalasData.filter(e => e.status === 'Confirmado').map(e => ({
                nome: `${nomes.get(e.cpf_substituto || e.cpf_voluntario) || 'Voluntário não encontrado'} (${e.inicio}–${e.fim})${e.cpf_substituto ? ' · substituto' : ''}`,
                tipo: MODALIDADES.find(m => m.id === e.modalidade)?.nome || (e.modalidade === 'cantina' ? 'Cantina' : 'Mesa')
            }));
        }

        const encontroGappusHoje = await EncontroGappus.findById(hojeLocal()).lean();
        res.render('index', {
            resumo: {
                hoje: totalAtendimentosHoje,
                taxaAbandono: abandonoApometria.taxaAbandono,
                apometriaUnica: abandonoApometria.totalAbandonos,
                totalBaseApometria: abandonoApometria.totalBase,
                detalheAtendimentos: atendimentosHoje,
                gappusHoje: encontroGappusHoje?.participantes.length || 0,
                voluntariosPorTipo,
                totalVoluntarios: voluntariosDB.length
            },
            escala_hoje,
            escalaPorData: escalasData.length > 0
        });

    } catch (err) {
        console.error("Erro no Dashboard:", err);
        res.status(500).send("Erro ao carregar dashboard.");
    }
};
