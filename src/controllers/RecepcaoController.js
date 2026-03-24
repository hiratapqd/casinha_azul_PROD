const Solicitacao = require('../models/Solicitacao');
const ConfiguracaoFluxo = require('../models/ConfiguracaoFluxo');

// Esta é a função que o router.get('/recepcao') procura
exports.exibirPaginaRecepcao = async (req, res) => {
    try {
        const configs = await ConfiguracaoFluxo.find().lean();
        res.render('recepcao', { configs });
    } catch (err) {
        console.error(err);
        res.status(500).send("Erro ao carregar recepção");
    }
};

// Esta é a função que o router.post('/api/recepcao/checkin') procura
exports.realizarCheckin = async (req, res) => {
    try {
        const { cpf, nome, queixa, terapias } = req.body;
        const hoje = new Date().toISOString().split('T')[0];

        // Se terapias vier como string única, transforma em array
        const listaTerapias = Array.isArray(terapias) ? terapias : [terapias];

        const promessas = listaTerapias.map(terapia => {
            const idComposto = `${cpf}_${terapia}_${hoje}`;
            return Solicitacao.findOneAndUpdate(
                { _id: idComposto },
                {
                    cpf_assistido: cpf,
                    nome_assistido: nome,
                    tipo_atendimento: terapia,
                    data_pedido: new Date(),
                    status: 'Aguardando',
                    queixa_motivo: queixa
                },
                { upsert: true, new: true }
            );
        });

        await Promise.all(promessas);
        res.status(200).json({ status: 'ok' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.realizarCheckin = async (req, res) => {
    try {
        let { cpf, nome, queixa, terapias } = req.body;
        const hoje = new Date().toISOString().split('T')[0];

        if (!Array.isArray(terapias)) terapias = [terapias];

        const promessas = terapias.map(terapia => {
            // Criamos o ID único: CPF + TERAPIA + DATA
            const idComposto = `${cpf}_${terapia}_${hoje}`;
            
            return Solicitacao.findOneAndUpdate(
                { _id: idComposto },
                {
                    cpf_assistido: cpf,
                    nome_assistido: nome,
                    tipo_atendimento: terapia,
                    data_pedido: new Date(),
                    status: 'Aguardando',
                    tipo:terapia,
                    queixa_motivo: queixa
                },
                { upsert: true, new: true }
            );
        });

        await Promise.all(promessas);
        res.status(200).json({ status: 'ok' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};