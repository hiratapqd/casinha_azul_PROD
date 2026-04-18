const Atendimento = require('../models/Atendimento');
const Assistido = require('../models/Assistido');
const Voluntario = require('../models/Voluntario');

exports.getAtendimentosHoje = async (req, res) => {
    try {
        const agora = new Date();
        const offsetBrasilia = -3;
        const dataBrasilia = new Date(agora.getTime() + (offsetBrasilia * 60 * 60 * 1000));
        const hojeString = dataBrasilia.toISOString().split('T')[0];

        const hojeInicio = new Date(`${hojeString}T00:00:00-03:00`);
        const hojeFim = new Date(`${hojeString}T23:59:59-03:00`);

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
            hoje: dataBrasilia.toLocaleDateString('pt-BR')
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
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() - 30);
        dataLimite.setHours(0, 0, 0, 0);

        const listaVoluntarios = await Atendimento.aggregate([
            {
                $match: {
                    voluntario: { $exists: true, $nin: [null, ''] }
                }
            },
            {
                $group: {
                    _id: '$voluntario',
                    ultimaParticipacao: { $max: '$data' }
                }
            },
            { $sort: { ultimaParticipacao: -1, _id: 1 } }
        ]);

        const voluntariosAtivos30Dias = listaVoluntarios.filter((v) => {
            return v.ultimaParticipacao && new Date(v.ultimaParticipacao) >= dataLimite;
        }).length;

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
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() - 90);
        dataLimite.setHours(0, 0, 0, 0);

        const voluntariosAtivos = await Voluntario.find({
            esta_ativo: { $nin: ['Não', 'Nao', 'não', 'nao'] }
        }).sort({ nome: 1 }).lean();

        const nomesVoluntarios = voluntariosAtivos
            .map((voluntario) => voluntario.nome)
            .filter(Boolean);

        const ultimasParticipacoes = nomesVoluntarios.length > 0
            ? await Atendimento.aggregate([
                {
                    $match: {
                        voluntario: { $exists: true, $nin: [null, ''] }
                    }
                },
                {
                    $project: {
                        data: 1,
                        voluntarioNormalizado: {
                            $toLower: {
                                $trim: { input: '$voluntario' }
                            }
                        }
                    }
                },
                {
                    $group: {
                        _id: '$voluntarioNormalizado',
                        ultimaParticipacao: { $max: '$data' }
                    }
                }
            ])
            : [];

        const mapaUltimasParticipacoes = Object.fromEntries(
            ultimasParticipacoes.map((item) => [item._id, item.ultimaParticipacao])
        );

        const voluntariosInativos = voluntariosAtivos
            .map((voluntario) => ({
                ...voluntario,
                ultimaParticipacao: mapaUltimasParticipacoes[voluntario.nome.trim().toLowerCase()] || null
            }))
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
            titulo: 'Voluntarios sem atendimento recente'
        });
    } catch (err) {
        console.error('Erro no relatorio de voluntarios inativos:', err);
        res.status(500).send('Erro ao processar relatorio.');
    }
};

exports.getApometriaInativos = async (req, res) => {
    try {
        const hoje = new Date();

        const data30 = new Date();
        data30.setDate(hoje.getDate() - 30);
        data30.setHours(23, 59, 59, 999);

        const data60 = new Date();
        data60.setDate(hoje.getDate() - 60);
        data60.setHours(23, 59, 59, 999);

        const data90 = new Date();
        data90.setDate(hoje.getDate() - 90);
        data90.setHours(23, 59, 59, 999);

        const ultimosAtendimentos = await Atendimento.aggregate([
            {
                $match: {
                    tipo: { $in: ['apometria', 'passe'] }
                }
            },
            {
                $group: {
                    _id: '$cpf_assistido',
                    nome: { $first: '$nome_assistido' },
                    ultimaData: { $max: '$data' }
                }
            }
        ]);

        const listas = { d30: [], d60: [], d90: [] };
        const counts = { d30: 0, d60: 0, d90: 0 };

        for (const registro of ultimosAtendimentos) {
            const dataAtendimento = new Date(registro.ultimaData);
            const cpfParaBusca = registro._id;
            const dadosCadastrais = await Assistido.findById(cpfParaBusca).lean();
            const item = {
                cpf: cpfParaBusca,
                nome: registro.nome,
                ultimaData: registro.ultimaData,
                telefone: dadosCadastrais ? (dadosCadastrais.telefone_assistido || '') : 'Nao cadastrado',
                email: dadosCadastrais ? (dadosCadastrais.email_assistido || '') : 'Nao cadastrado'
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

        res.render('relatorios/apometria_inativos', {
            listas,
            counts
        });
    } catch (err) {
        console.error('Erro ao calcular inativos:', err);
        res.status(500).send('Erro ao processar inativos.');
    }
};
