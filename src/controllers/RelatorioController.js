const Atendimento = require('../models/Atendimento');
const Assistido = require('../models/Assistido');
const Voluntario = require('../models/Voluntario');
const PresencaVoluntario = require('../models/PresencaVoluntario');
const EncontroGappus = require('../models/EncontroGappus');
const { resumirAbandonoApometria } = require('../services/AcompanhamentosHistoricos');
const { hojeLocal, inicioDia, fimDia, somarDiasISO, formatarData } = require('../utils/operacao');

function normalizarCpf(cpf = '') {
    const cpfNumerico = String(cpf).replace(/\D/g, '');

    return cpfNumerico && cpfNumerico.length < 11
        ? cpfNumerico.padStart(11, '0')
        : cpfNumerico;
}

function consolidarPresencasPorCpf(registros = []) {
    const presencasPorCpf = new Map();

    registros.forEach((registro) => {
        const cpf = normalizarCpf(registro.cpf ?? registro._id);
        if (cpf.length !== 11) return;

        const participacao = registro.ultimaParticipacao
            ? new Date(registro.ultimaParticipacao)
            : null;
        const existente = presencasPorCpf.get(cpf);

        if (!existente) {
            presencasPorCpf.set(cpf, {
                ...registro,
                _id: cpf,
                cpf,
                ultimaParticipacao: participacao,
                totalPresencas: Number(registro.totalPresencas) || 0
            });
            return;
        }

        existente.totalPresencas += Number(registro.totalPresencas) || 0;

        if (participacao && (!existente.ultimaParticipacao || participacao > existente.ultimaParticipacao)) {
            existente.ultimaParticipacao = participacao;
            existente.nome = registro.nome || existente.nome;
        }
    });

    return Array.from(presencasPorCpf.values());
}

exports.getAtendimentosHoje = async (req, res) => {
    try {
        const hojeString = hojeLocal();
        const hojeInicio = inicioDia(hojeString);
        const hojeFim = fimDia(hojeString);

        const atendimentos = await Atendimento.find({
            data: { $gte: hojeInicio, $lte: hojeFim }
        }).sort({ data: -1 }).lean();

        const counts = {
            reiki: 0,
            apometria: 0,
            auriculo: 0,
            passe: 0,
            maos_sem_fronteiras: 0,
            homeopatia: 0
        };

        atendimentos.forEach((a) => {
            const tipoNormalizado = a.tipo ? a.tipo.trim().toLowerCase() : '';
            if (Object.prototype.hasOwnProperty.call(counts, tipoNormalizado)) {
                counts[tipoNormalizado]++;
            }
        });

        const tabs = [
            { slug: '__todos', nome: 'Todos' },
            { slug: 'reiki', nome: 'Reiki' },
            { slug: 'apometria', nome: 'Apometria' },
            { slug: 'auriculo', nome: 'Auriculo' },
            { slug: 'passe', nome: 'Passe' },
            { slug: 'maos_sem_fronteiras', nome: 'Maos sem Fronteiras' },
            { slug: 'homeopatia', nome: 'Homeopatia' }
        ];

        res.render('relatorios/atendimentos_hoje', {
            atendimentos,
            counts,
            tabs,
            hoje: formatarData(hojeString)
        });
    } catch (err) {
        console.error('Erro no RelatorioController:', err);
        res.status(500).send('Erro ao carregar relatorio.');
    }
};

exports.getRelatorioGeralAssistidos = async (req, res) => {
    try {
        const assistidosComAtendimentos = await Assistido.aggregate([
            {
                $lookup: {
                    from: 'atendimentos',
                    localField: '_id',
                    foreignField: 'cpf_assistido',
                    as: 'meus_atendimentos'
                }
            },
            {
                $project: {
                    cpf: '$_id',
                    nome: { $ifNull: ['$nome', '$nome_assistido'] },
                    telefone: { $ifNull: ['$telefone', '$telefone_assistido'] },
                    email: { $ifNull: ['$email', '$email_assistido'] },
                    status: 1,
                    tratamentos: {
                        $reduce: {
                            input: '$meus_atendimentos.tipo',
                            initialValue: [],
                            in: { $setUnion: ['$$value', ['$$this']] }
                        }
                    },
                    tratamentosResumo: {
                        $map: {
                            input: {
                                $reduce: {
                                    input: '$meus_atendimentos.tipo',
                                    initialValue: [],
                                    in: { $setUnion: ['$$value', ['$$this']] }
                                }
                            },
                            as: 'tipo',
                            in: {
                                tipo: '$$tipo',
                                quantidade: {
                                    $size: {
                                        $filter: {
                                            input: '$meus_atendimentos',
                                            as: 'atendimento',
                                            cond: { $eq: ['$$atendimento.tipo', '$$tipo'] }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            { $sort: { nome: 1 } }
        ]);

        res.render('relatorios/relatorio_assistidos', { assistidos: assistidosComAtendimentos });
    } catch (err) {
        console.error('Erro no Relatorio:', err);
        res.status(500).send('Erro ao carregar dados.');
    }
};

exports.getRelatorioVoluntarios = async (req, res) => {
    try {
        const dataLimite = inicioDia(somarDiasISO(hojeLocal(), -30));

        const presencasAgrupadas = await PresencaVoluntario.aggregate([
            {
                $match: {
                    cpf_voluntario: { $exists: true, $nin: [null, ''] },
                    data_presenca: { $gte: dataLimite },
                    origem: { $ne: 'atendimentos' }
                }
            },
            { $sort: { data_presenca: -1, data_registro: -1 } },
            {
                $group: {
                    _id: '$cpf_voluntario',
                    cpf: { $first: '$cpf_voluntario' },
                    nome: { $first: '$nome_voluntario' },
                    ultimaParticipacao: { $first: '$data_presenca' },
                    totalPresencas: { $sum: 1 }
                }
            }
        ]);

        const listaVoluntarios = consolidarPresencasPorCpf(presencasAgrupadas)
            .sort((a, b) => (
                new Date(b.ultimaParticipacao) - new Date(a.ultimaParticipacao)
                || (a.nome || '').localeCompare(b.nome || '')
            ));

        const voluntariosAtivos30Dias = listaVoluntarios.length;

        res.render('relatorios/relatorio_voluntarios', {
            voluntarios: listaVoluntarios,
            resumo: {
                ativos30Dias: voluntariosAtivos30Dias
            },
            titulo: 'Voluntarios Ativos'
        });
    } catch (err) {
        console.error('Erro no relatorio de voluntarios:', err);
        res.status(500).send('Erro ao processar relatorio.');
    }
};

exports.getVoluntariosInativos = async (req, res) => {
    try {
        const dataLimite = inicioDia(somarDiasISO(hojeLocal(), -90));

        const voluntariosAtivos = await Voluntario.find({
            esta_ativo: { $nin: ['Não', 'Nao', 'não', 'nao'] }
        }).sort({ nome: 1 }).lean();

        const cpfsVoluntarios = new Set(
            voluntariosAtivos
                .map((voluntario) => normalizarCpf(voluntario._id))
                .filter((cpf) => cpf.length === 11)
        );

        const ultimasParticipacoesAgrupadas = cpfsVoluntarios.size > 0
            ? await PresencaVoluntario.aggregate([
                {
                    $match: {
                        cpf_voluntario: { $exists: true, $nin: [null, ''] },
                        data_presenca: { $exists: true, $ne: null },
                        origem: { $ne: 'atendimentos' }
                    }
                },
                {
                    $group: {
                        _id: '$cpf_voluntario',
                        cpf: { $first: '$cpf_voluntario' },
                        ultimaParticipacao: { $max: '$data_presenca' },
                        totalPresencas: { $sum: 1 }
                    }
                }
            ])
            : [];

        const mapaPresencas = Object.fromEntries(
            consolidarPresencasPorCpf(ultimasParticipacoesAgrupadas)
                .filter((item) => cpfsVoluntarios.has(item.cpf))
                .map((item) => [item.cpf, item])
        );

        const voluntariosInativos = voluntariosAtivos
            .map((voluntario) => {
                const cpf = normalizarCpf(voluntario._id);
                const presenca = mapaPresencas[cpf];

                return {
                    ...voluntario,
                    cpf,
                    ultimaParticipacao: presenca ? presenca.ultimaParticipacao : null
                };
            })
            .filter((voluntario) => !voluntario.ultimaParticipacao || new Date(voluntario.ultimaParticipacao) < dataLimite)
            .sort((a, b) => {
                if (!a.ultimaParticipacao && !b.ultimaParticipacao) return a.nome.localeCompare(b.nome);
                if (!a.ultimaParticipacao) return -1;
                if (!b.ultimaParticipacao) return 1;
                return new Date(a.ultimaParticipacao) - new Date(b.ultimaParticipacao);
            });

        res.render('relatorios/relatorio_voluntarios_inativos', {
            voluntarios: voluntariosInativos,
            resumo: {
                inativos90Dias: voluntariosInativos.length
            },
            titulo: 'Voluntarios sem presenca recente'
        });
    } catch (err) {
        console.error('Erro no relatorio de voluntarios inativos:', err);
        res.status(500).send('Erro ao processar relatorio.');
    }
};

exports.getApometriaInativos = async (req, res) => {
    try {
        const encontrosGappus = await EncontroGappus.find().lean();
        const hoje = hojeLocal();
        const data30 = fimDia(somarDiasISO(hoje, -30));
        const data60 = fimDia(somarDiasISO(hoje, -60));
        const data90 = fimDia(somarDiasISO(hoje, -90));

        const historicosPorAssistido = await Atendimento.aggregate([
            {
                $match: {
                    cpf_assistido: { $exists: true, $nin: [null, ''] }
                }
            },
            { $sort: { cpf_assistido: 1, data: 1, _id: 1 } },
            {
                $group: {
                    _id: '$cpf_assistido',
                    atendimentos: {
                        $push: {
                            data: '$data',
                            nome: '$nome_assistido',
                            tipo: '$tipo'
                        }
                    }
                }
            }
        ]);

        const historico = historicosPorAssistido.flatMap(registro => (registro.atendimentos || []).map(a => ({ ...a, cpf_assistido: registro._id })));
        const { candidatos } = resumirAbandonoApometria(historico, encontrosGappus);

        const dadosCadastrais = await Assistido.find({
            _id: { $in: candidatos.map((item) => item.cpf) }
        }).lean();

        const dadosPorCpf = new Map(dadosCadastrais.map((assistido) => [assistido._id, assistido]));

        const listas = { d30: [], d60: [], d90: [] };
        const counts = { d30: 0, d60: 0, d90: 0 };

        for (const candidato of candidatos) {
            const dataAtendimento = new Date(candidato.ultimaData);
            const cpfParaBusca = candidato.cpf;
            const cadastro = dadosPorCpf.get(cpfParaBusca);
            const item = {
                cpf: cpfParaBusca,
                nome: candidato.nome,
                ultimaData: candidato.ultimaData,
                telefone: cadastro ? (cadastro.telefone_assistido || '') : 'Nao cadastrado',
                email: cadastro ? (cadastro.email_assistido || '') : 'Nao cadastrado'
            };

            if (dataAtendimento < data90) {
                listas.d90.push(item);
                counts.d90++;
            } else if (dataAtendimento < data60) {
                listas.d60.push(item);
                counts.d60++;
            } else if (dataAtendimento < data30) {
                listas.d30.push(item);
                counts.d30++;
            }
        }

        Object.values(listas).forEach((lista) => {
            lista.sort((a, b) => new Date(a.ultimaData) - new Date(b.ultimaData));
        });

        res.render('relatorios/apometria_inativos', {
            listas,
            counts
        });
    } catch (err) {
        console.error('Erro ao calcular inativos:', err);
        res.status(500).send('Erro ao processar inativos.');
    }
};
