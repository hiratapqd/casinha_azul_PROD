// src/controllers/SolicitacaoController.js
const Solicitacao = require('../models/Solicitacao');
const Atendimento = require('../models/Atendimento');
const Assistido = require('../models/Assistido');
const { listarConfiguracoes } = require('../services/ConfiguracaoOperacao');
const { hojeLocal, dataValida, inicioDia, fimDia, diaSemana, formatarData, calcularIdade, DIAS } = require('../utils/operacao');

exports.criarSolicitacaoComCadastro = async (req, res) => {
    try {
        const dados = req.body;
        const tipoParaBusca = 'apometria';
        dados.cpf_assistido = String(dados.cpf_assistido || '').replace(/\D/g, '');
        if (dados.cpf_assistido.length !== 11 || !dataValida(dados.data) || !String(dados.nome || '').trim()) {
            return res.status(400).json({ status: 'erro', mensagem: 'Informe CPF, nome e uma data válida para a solicitação.' });
        }
        const configOperacao = (await listarConfiguracoes()).find(c => c.id === tipoParaBusca);
        if (!configOperacao.ativa) return res.status(400).json({ status: 'erro', mensagem: 'A apometria está inativa nas configurações.' });
        if (await Solicitacao.exists({ _id: `${dados.cpf_assistido}_${dados.data}` })) return res.json({ status: 'duplicado', mensagem: 'Este CPF já possui uma solicitação hoje.' });

        const agoraUTC = new Date();

        const hojeInicio = inicioDia(dados.data);
        const hojeFim = fimDia(dados.data);

        const diaNome = DIAS[diaSemana(dados.data)];
        const configLimite = configOperacao;

        let limitePrincipal = Infinity;
        let limiteEspera = 0;

        if (configLimite) {
            if (configLimite.limites && configLimite.limites[diaNome] !== undefined) {
                limitePrincipal = configLimite.limites[diaNome];
            } else if (configLimite.limite_principal !== undefined && configLimite.limite_principal !== null) {
                limitePrincipal = configLimite.limite_principal;
            }

            limiteEspera = configLimite.limites_espera?.[diaNome] ?? configLimite.limite_espera ?? 0;
        } else {
            limitePrincipal = 8;
        }
        const limiteTotal = limitePrincipal === 0 ? 0 : limitePrincipal + limiteEspera;

        const totalHoje = await Solicitacao.countDocuments({
            tipo: tipoParaBusca,
            status: { $ne: 'Cancelado' },
            data_pedido: {
                $gte: hojeInicio,
                $lte: hojeFim
            }
        });

        if (totalHoje >= limiteTotal) {
            return res.json({
                status: 'limite_excedido',
                mensagem: `O limite de atendimentos para ${diaNome} (${limiteTotal} vagas) ja foi alcancado.`
            });
        }

        const dataSolicitacao = inicioDia(dados.data);
        const ultimoAtendimento = await Atendimento.findOne({
            cpf_assistido: dados.cpf_assistido,
            tipo: tipoParaBusca
        }).sort({ data: -1 }).lean();

        if (ultimoAtendimento) {
            const [totalApometriasHistoricas, totalPassesHistoricos, totalOutrosAtendimentos] = await Promise.all([
                Atendimento.countDocuments({
                    cpf_assistido: dados.cpf_assistido,
                    tipo: 'apometria'
                }),
                Atendimento.countDocuments({
                    cpf_assistido: dados.cpf_assistido,
                    tipo: 'passe'
                }),
                Atendimento.countDocuments({
                    cpf_assistido: dados.cpf_assistido,
                    tipo: { $nin: ['apometria', 'passe'] }
                })
            ]);

            const diasDeBloqueio =
                totalApometriasHistoricas === 1 &&
                totalPassesHistoricos === 1 &&
                totalOutrosAtendimentos === 0
                    ? configOperacao.intervalo_sem_retorno_dias
                    : configOperacao.intervalo_dias;

            const dataLiberacao = new Date(new Date(ultimoAtendimento.data).getTime() + diasDeBloqueio * 24 * 60 * 60 * 1000);

            if (dataSolicitacao < dataLiberacao) {
                return res.json({
                    status: 'bloqueado_intervalo',
                    mensagem: `Pelo intervalo desde o ultimo ciclo de atendimento, uma nova apometria está liberada apenas a partir de ${formatarData(dataLiberacao)}.`
                });
            }
        }

        if (dados.data_nascimento && !dataValida(dados.data_nascimento)) return res.status(400).json({ status: 'erro', mensagem: 'Data de nascimento inválida.' });
        const idade = dados.data_nascimento ? calcularIdade(dados.data_nascimento) : undefined;

        await Assistido.findByIdAndUpdate(
            dados.cpf_assistido,
            {
                nome_assistido: dados.nome,
                telefone_assistido: dados.telefone,
                data_nascimento_assistido: dados.data_nascimento ? inicioDia(dados.data_nascimento) : null,
                sexo_assistido: dados.sexo,
                religiao_assistido: dados.religiao,
                cidade_assistido: dados.cidade,
                uf_assistido: dados.uf,
                email_assistido: dados.email,
                status: 'Ativo'
            },
            { upsert: true, returnDocument: 'after' }
        );

        const idSolicitacao = `${dados.cpf_assistido}_${dados.data}`;

        const novaPosicao = totalHoje + 1;

        const novaSolicitacao = new Solicitacao({
            _id: idSolicitacao,
            nome_assistido: dados.nome,
            idade_assistido: idade,
            sendo_atendido: dados.atendimento_por,
            queixa_motivo: dados.queixa,
            posicao: totalHoje + 1,
            data_pedido: dados.data === hojeLocal() ? agoraUTC : inicioDia(dados.data),
            tipo: tipoParaBusca,
            status: (totalHoje + 1) <= limitePrincipal ? 'Confirmado' : 'Espera'
        });

        try {
            await novaSolicitacao.save();

            return res.json({
                status: 'sucesso',
                mensagem: 'Solicitacao registrada!',
                posicao: novaPosicao,
                limite: Number.isFinite(limitePrincipal) ? limitePrincipal : novaPosicao
            });
        } catch (erroSave) {
            if (erroSave.code === 11000) {
                return res.json({
                    status: 'duplicado',
                    mensagem: 'Este CPF ja possui uma solicitacao para este dia.'
                });
            }

            return res.status(500).json({ status: 'erro', mensagem: erroSave.message });
        }
    } catch (err) {
        if (err.code === 11000) {
            return res.json({ status: 'duplicado', mensagem: 'O assistido ja possui uma solicitacao hoje.' });
        }
        res.status(500).json({ status: 'erro', mensagem: err.message });
    }
};

exports.buscarHistorico = async (req, res) => {
    try {
        const { cpf } = req.params;
        const historico = await Atendimento.find({
            cpf_assistido: cpf,
            tipo: 'apometria'
        })
            .sort({ data: -1 })
            .limit(12)
            .lean();

        const historicoFormatado = historico.map((item) => ({
            data_pedido: item.data,
            queixa_motivo: item.observacoes || '',
            voluntario: item.voluntario || '',
            status: 'Atendido'
        }));

        res.json(historicoFormatado);
    } catch (err) {
        res.status(500).json([]);
    }
};

exports.getFilaHoje = async (req, res) => {
    try {
        const hojeInicio = inicioDia(hojeLocal());
        const hojeFim = fimDia(hojeLocal());

        const solicitacoes = await Solicitacao.find({
            data_pedido: { $gte: hojeInicio, $lte: hojeFim }
        }).sort({ data_pedido: 1 });

        res.render('fila_atendimento', { solicitacoes });
    } catch (error) {
        console.error('Erro ao buscar fila:', error);
        res.status(500).send('Erro ao carregar a fila.');
    }
};

exports.iniciarAtendimento = async (req, res) => {
    try {
        const { id } = req.params;

        await Solicitacao.findOneAndUpdate(
            { _id: id },
            { status: 'Em Atendimento' }
        );

        res.redirect('/fila-atendimento');
    } catch (err) {
        console.error('Erro ao iniciar atendimento:', err);
        res.status(500).send('Erro ao atualizar status.');
    }
};

exports.cancelarSolicitacao = async (req, res) => {
    try {
        const { id } = req.params;

        await Solicitacao.findOneAndUpdate(
            { _id: id },
            { status: 'Cancelado' }
        );

        res.redirect('/fila-atendimento');
    } catch (err) {
        console.error('Erro ao cancelar solicitacao:', err);
        res.status(500).send('Erro ao processar o cancelamento.');
    }
};
