const Voluntario = require('../models/Voluntario');
const Atendimento = require('../models/Atendimento');
const PresencaVoluntario = require('../models/PresencaVoluntario');
const { hojeLocal, inicioDia, formatarData } = require('../utils/operacao');

const modalidadesDisponibilidade = [
    { id: 'apometria', label: 'Apometria' },
    { id: 'reiki', label: 'Reiki' },
    { id: 'auriculo', label: 'Auriculo' },
    { id: 'maos', label: 'Maos Sem Fronteiras' },
    { id: 'homeopatia', label: 'Homeopatia' },
    { id: 'passe', label: 'Passe' },
    { id: 'gappus', label: 'GAPPUS' },
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

function normalizarCpf(cpf = '') {
    return String(cpf).replace(/\D/g, '');
}

function criarRegexCpfFlexivel(cpf = '') {
    const cpfLimpo = normalizarCpf(cpf);
    if (!cpfLimpo) return null;

    return new RegExp(`^\\D*${cpfLimpo.split('').join('\\D*')}\\D*$`);
}

function obterHojeSaoPaulo() {
    const dataIso = hojeLocal();

    return {
        dataIso,
        dataInicio: inicioDia(dataIso),
        dataExibicao: formatarData(dataIso)
    };
}

function escapeRegex(valor = '') {
    return valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderFormularioPresenca(res, feedback = null, statusCode = 200) {
    const hoje = obterHojeSaoPaulo();

    return res.status(statusCode).render('voluntarios/presenca', {
        dataHoje: hoje.dataExibicao,
        feedback
    });
}

function montarDisponibilidade(dados = {}) {
    return Object.fromEntries(
        modalidadesDisponibilidade.map(({ id }) => {
            const valor = dados[`disp_${id}`];
            const dias = Array.isArray(valor) ? valor : (valor ? [valor] : []);

            return [id, dias];
        })
    );
}

async function buscarVoluntarioPorCpf(cpf) {
    const cpfRegex = criarRegexCpfFlexivel(cpf);
    const voluntario = await Voluntario.findById(cpf).lean();

    return voluntario || Voluntario.findOne({ _id: cpfRegex }).lean();
}

exports.getDadosVoluntario = async (req, res) => {
    try {
        const cpf = normalizarCpf(req.params.cpf);

        if (cpf.length !== 11) {
            return res.status(400).json({
                status: 'erro',
                mensagem: 'Informe um CPF com 11 digitos.'
            });
        }

        const voluntario = await buscarVoluntarioPorCpf(cpf);

        if (!voluntario) {
            return res.status(404).json(null);
        }

        return res.json({
            cpf: normalizarCpf(voluntario._id),
            nome: voluntario.nome || '',
            telefone: voluntario.telefone || '',
            email: voluntario.email || '',
            mediunidade: voluntario.mediunidade || '',
            disponibilidade: voluntario.disponibilidade || {}
        });
    } catch (err) {
        console.error('Erro ao buscar voluntario:', err);
        return res.status(500).json({
            status: 'erro',
            mensagem: 'Nao foi possivel buscar o voluntario agora.'
        });
    }
};

exports.criarVoluntario = async (req, res) => {
    try {
        const dados = req.body;
        const cpf = normalizarCpf(dados.cpf);
        const forceUpdate = dados.forceUpdate === 'true' || dados.forceUpdate === true;

        if (cpf.length !== 11) {
            return res.status(400).json({
                status: 'erro',
                mensagem: 'Informe um CPF com 11 digitos.'
            });
        }

        const existe = await buscarVoluntarioPorCpf(cpf);
        if (existe && !forceUpdate) {
            return res.json({ status: 'conflito', mensagem: 'CPF ja cadastrado' });
        }

        await Voluntario.findByIdAndUpdate(
            existe ? existe._id : cpf,
            {
                nome: dados.nome,
                telefone: dados.telefone,
                email: dados.email,
                mediunidade: dados.mediunidade,
                esta_ativo: 'Sim',
                disponibilidade: montarDisponibilidade(dados)
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

exports.getFormularioPresenca = async (req, res) => {
    renderFormularioPresenca(res);
};

exports.registrarPresenca = async (req, res) => {
    try {
        const cpf = normalizarCpf(req.body.cpf);
        const hoje = obterHojeSaoPaulo();

        if (cpf.length !== 11) {
            return renderFormularioPresenca(res, {
                tipo: 'erro',
                titulo: 'CPF invalido',
                mensagem: 'Informe um CPF com 11 digitos.'
            }, 400);
        }

        const cpfRegex = criarRegexCpfFlexivel(cpf);
        const voluntario = await Voluntario.findById(cpf).lean()
            || await Voluntario.findOne({ _id: cpfRegex }).lean();

        if (!voluntario) {
            return renderFormularioPresenca(res, {
                tipo: 'erro',
                titulo: 'Voluntario nao encontrado',
                mensagem: 'Este CPF nao possui cadastro de voluntario.'
            }, 404);
        }

        const idPresenca = `${cpf}_${hoje.dataIso}`;
        const presencaExistente = await PresencaVoluntario.findById(idPresenca).lean();

        if (presencaExistente) {
            return renderFormularioPresenca(res, {
                tipo: 'alerta',
                titulo: 'Presenca ja registrada',
                mensagem: `${voluntario.nome} ja possui presenca registrada para hoje.`
            });
        }

        await PresencaVoluntario.create({
            _id: idPresenca,
            cpf_voluntario: cpf,
            nome_voluntario: voluntario.nome,
            data_presenca: hoje.dataInicio
        });

        return renderFormularioPresenca(res, {
            tipo: 'sucesso',
            titulo: 'Presenca registrada',
            mensagem: `${voluntario.nome} foi registrado em ${hoje.dataExibicao}.`
        });
    } catch (err) {
        if (err.code === 11000) {
            return renderFormularioPresenca(res, {
                tipo: 'alerta',
                titulo: 'Presenca ja registrada',
                mensagem: 'Este CPF ja possui presenca registrada para hoje.'
            });
        }

        console.error('Erro ao registrar presenca de voluntario:', err);
        return renderFormularioPresenca(res, {
            tipo: 'erro',
            titulo: 'Erro ao registrar',
            mensagem: 'Nao foi possivel registrar a presenca agora.'
        }, 500);
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
