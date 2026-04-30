const Voluntario = require('../models/Voluntario');
const Atendimento = require('../models/Atendimento');

const modalidadesDisponibilidade = [
    { id: 'apometria', label: 'Apometria' },
    { id: 'reiki', label: 'Reiki' },
    { id: 'auriculo', label: 'Auriculo' },
    { id: 'maos', label: 'Maos Sem Fronteiras' },
    { id: 'homeopatia', label: 'Homeopatia' },
    { id: 'passe', label: 'Passe' },
    { id: 'cantina', label: 'Cantina' },
    { id: 'mesa', label: 'Mesa' }
];

const diasDisponibilidade = [
    { value: 'seg', label: 'Segunda' },
    { value: 'ter', label: 'Terca' },
    { value: 'qua', label: 'Quarta' },
    { value: 'qui', label: 'Quinta' },
    { value: 'sex', label: 'Sexta' },
    { value: 's\u00e1b', label: 'Sabado' },
    { value: 'dom', label: 'Domingo' }
];

function escapeRegex(valor = '') {
    return valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

exports.criarVoluntario = async (req, res) => {
    try {
        const dados = req.body;
        const forceUpdate = dados.forceUpdate === 'true' || dados.forceUpdate === true;

        const existe = await Voluntario.findById(dados.cpf);
        if (existe && !forceUpdate) {
            return res.json({ status: 'conflito', mensagem: 'CPF ja cadastrado' });
        }

        await Voluntario.findByIdAndUpdate(
            dados.cpf,
            {
                _id: dados.cpf,
                nome: dados.nome,
                telefone: dados.telefone,
                email: dados.email,
                mediunidade: dados.mediunidade,
                esta_ativo: 'Sim',
                disponibilidade: {
                    apometria: dados.disp_apometria || [],
                    reiki: dados.disp_reiki || [],
                    auriculo: dados.disp_auriculo || [],
                    maos: dados.disp_maos || [],
                    homeopatia: dados.disp_homeopatia || [],
                    passe: dados.disp_passe || [],
                    cantina: dados.disp_cantina || [],
                    mesa: dados.disp_mesa || []
                }
            },
            { upsert: true, returnDocument: 'after' }
        );

        res.json({ status: 'sucesso', acao: 'gravado' });
    } catch (err) {
        if (err.code === 11000) {
            return res.json({ status: 'conflito', mensagem: 'CPF ja cadastrado.' });
        }
        console.error('Erro ao salvar:', err);
        res.status(500).json({ status: 'erro', mensagem: err.message });
    }
};

exports.getDisponibilidadeVoluntarios = async (req, res) => {
    try {
        const filtros = {
            busca: (req.query.busca || '').trim(),
            status: req.query.status || 'todos',
            modalidade: req.query.modalidade || '',
            dia: req.query.dia || ''
        };

        if (!['todos', 'ativos', 'inativos'].includes(filtros.status)) {
            filtros.status = 'todos';
        }

        if (filtros.modalidade && !modalidadesDisponibilidade.some((modalidade) => modalidade.id === filtros.modalidade)) {
            filtros.modalidade = '';
        }

        if (filtros.dia && !diasDisponibilidade.some((dia) => dia.value === filtros.dia)) {
            filtros.dia = '';
        }

        const filtroMongo = {};
        const filtrosCombinados = [];

        if (filtros.status === 'ativos') {
            filtroMongo.esta_ativo = 'Sim';
        } else if (filtros.status === 'inativos') {
            filtroMongo.esta_ativo = { $ne: 'Sim' };
        }

        if (filtros.busca) {
            const regex = new RegExp(escapeRegex(filtros.busca), 'i');
            filtrosCombinados.push({ $or: [
                { _id: regex },
                { nome: regex },
                { telefone: regex },
                { email: regex },
                { mediunidade: regex }
            ] });
        }

        if (filtros.modalidade && filtros.dia) {
            filtroMongo[`disponibilidade.${filtros.modalidade}`] = filtros.dia;
        } else if (filtros.modalidade) {
            filtroMongo[`disponibilidade.${filtros.modalidade}.0`] = { $exists: true };
        } else if (filtros.dia) {
            filtrosCombinados.push({ $or: modalidadesDisponibilidade.map((modalidade) => ({
                    [`disponibilidade.${modalidade.id}`]: filtros.dia
                }))
            });
        }

        if (filtrosCombinados.length > 0) {
            filtroMongo.$and = filtrosCombinados;
        }

        const voluntarios = await Voluntario.find(filtroMongo)
            .sort({ nome: 1 })
            .lean();

        const resumo = voluntarios.reduce(
            (acc, voluntario) => {
                const disponibilidade = voluntario.disponibilidade || {};
                const possuiDisponibilidade = modalidadesDisponibilidade.some((modalidade) => (
                    Array.isArray(disponibilidade[modalidade.id])
                        ? disponibilidade[modalidade.id].length > 0
                        : Boolean(disponibilidade[modalidade.id])
                ));

                acc.total += 1;
                if (voluntario.esta_ativo === 'Sim') acc.ativos += 1;
                if (possuiDisponibilidade) acc.comDisponibilidade += 1;

                return acc;
            },
            { total: 0, ativos: 0, comDisponibilidade: 0 }
        );

        res.render('disponibilidade_voluntarios', {
            voluntarios,
            filtros,
            modalidades: modalidadesDisponibilidade,
            dias: diasDisponibilidade,
            resumo
        });
    } catch (err) {
        console.error('Erro ao listar disponibilidade dos voluntarios:', err);
        res.status(500).send('Erro ao listar disponibilidade dos voluntarios');
    }
};

exports.getVisualizarVoluntarios = async (req, res) => {
    try {
        const { dia, terapia } = req.query;
        const filtro = {};

        if (dia && terapia) {
            filtro[`disponibilidade.${terapia}`] = dia;
        }

        const voluntarios = await Voluntario.find(filtro).sort({ nome: 1 }).lean();

        const nomesVoluntarios = voluntarios
            .map((voluntario) => voluntario.nome)
            .filter(Boolean);

        const nomesNormalizados = nomesVoluntarios.map((nome) => nome.trim().toLowerCase());

        const ultimosAtendimentos = nomesVoluntarios.length > 0
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
                    $match: {
                        voluntarioNormalizado: { $in: nomesNormalizados }
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

        const mapaUltimosAtendimentos = Object.fromEntries(
            ultimosAtendimentos.map((item) => [item._id, item.ultimaParticipacao])
        );

        const voluntariosComUltimoAtendimento = voluntarios.map((voluntario) => ({
            ...voluntario,
            ultimaParticipacao: mapaUltimosAtendimentos[voluntario.nome.trim().toLowerCase()] || null
        }));

        res.render('visualizar_voluntarios', {
            voluntarios: voluntariosComUltimoAtendimento,
            filtros: { dia, terapia }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao filtrar voluntarios');
    }
};
