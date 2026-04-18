const Solicitacao = require('../models/Solicitacao');
const ConfiguracaoFluxo = require('../models/ConfiguracaoFluxo');

exports.exibirPaginaRecepcao = async (req, res) => {
    try {
        const configs = await ConfiguracaoFluxo.find().lean();
        res.render('recepcao', { configs });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao carregar recepcao');
    }
};

exports.realizarCheckin = async (req, res) => {
    try {
        let { cpf, nome, queixa, terapias } = req.body;
        const hoje = new Date().toISOString().split('T')[0];

        if (!Array.isArray(terapias)) {
            terapias = [terapias];
        }

        const promessas = terapias.map((terapia) => {
            const idComposto = `${cpf}_${terapia}_${hoje}`;

            return Solicitacao.findOneAndUpdate(
                { _id: idComposto },
                {
                    cpf_assistido: cpf,
                    nome_assistido: nome,
                    tipo_atendimento: terapia,
                    data_pedido: new Date(),
                    status: 'Aguardando',
                    tipo: terapia,
                    queixa_motivo: queixa
                },
                { upsert: true, returnDocument: 'after' }
            );
        });

        await Promise.all(promessas);
        res.status(200).json({ status: 'ok' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
