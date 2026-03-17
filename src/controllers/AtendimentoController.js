const Atendimento = require('../models/Atendimento');
const Solicitacao = require('../models/Solicitacao');
const Assistido = require('../models/Assistido');
const ConfiguracaoFluxo = require('../models/ConfiguracaoFluxo'); // Verifique se o caminho está correto

exports.getDadosIniciais = async (req, res) => {
    try {
        const cpf = req.params.cpf;
        
        // Busca pelo _id ou pelo campo cpf_assistido
        let assistido = await Assistido.findById(cpf).lean();
        if (!assistido) {
            assistido = await Assistido.findOne({ cpf_assistido: cpf }).lean();
        }
        
        if (!assistido) {
            return res.status(404).json(null);
        }

        res.json(assistido);
    } catch (err) {
        console.error("Erro ao buscar assistido:", err);
        res.status(500).json(null);
    }
};

exports.salvarAtendimento = async (req, res) => {
    try {
        const dados = req.body;
        const hoje = new Date().toISOString().split('T')[0];
        const idSolicitacaoAtual = `${dados.cpf_assistido}_${hoje}`;

        // 1. Grava o histórico do atendimento atual
        const novoAtendimento = new Atendimento({
            data: new Date(),
            cpf_assistido: dados.cpf_assistido,
            nome_assistido: dados.nome_assistido,
            voluntario: dados.voluntario,
            observacoes: dados.observacoes,
            tipo: dados.tipo 
        });
        await novoAtendimento.save();

        // 2. Marca a solicitação da terapia atual como 'Atendido'
        await Solicitacao.findByIdAndUpdate(idSolicitacaoAtual, { status: 'Atendido' });

        // 3. Lógica de Fluxo Dinâmica (Passe automático)
        const regra = await ConfiguracaoFluxo.findOne({ terapia: dados.tipo }).lean();

        if (regra && regra.geraPasseAoFinalizar === true) {
            // ID Único para o passe: impede duplicidade no mesmo dia
            const idFilaPasse = `${dados.cpf_assistido}_PASSE_${hoje}`;
            
            const jaExistePasse = await Solicitacao.findById(idFilaPasse);

            if (!jaExistePasse) {
                const novaFilaPasse = new Solicitacao({
                    _id: idFilaPasse,
                    cpf_assistido: dados.cpf_assistido,
                    nome_assistido: dados.nome_assistido,
                    data_pedido: new Date(),
                    tipo_atendimento: 'passe',
                    status: 'Aguardando',
                    queixa_motivo: `Encaminhado após: ${dados.tipo}`
                });
                await novaFilaPasse.save();
            }
        }

        res.status(200).json({ status: 'sucesso' });
    } catch (err) {
        console.error("Erro ao salvar atendimento:", err);
        res.status(500).json({ status: 'erro', mensagem: err.message });
    }
};

/* // Busca dados para preencher o topo da ficha (Nome, etc)
exports.getDadosIniciais = async (req, res) => {
    try {
        const cpf = req.params.cpf;
        const assistido = await Assistido.findById(cpf).lean() || await Assistido.findOne({ cpf_assistido: cpf }).lean();
        
        if (!assistido) return res.status(404).json(null);
        res.json(assistido); 
    } catch (err) {
        res.status(500).json(null);
    }
}; */

// Busca histórico específico para a tabela inferior
exports.getHistoricoPorTipo = async (req, res) => {
    try {
        const { tipo, cpf } = req.params;
        const historico = await Atendimento.find({ cpf_assistido: cpf, tipo: tipo }).sort({ data: -1 }).lean();
        
        // Busca a queixa na solicitação do dia (se houver)
        const hoje = new Date().toISOString().split('T')[0];
        const solicitacao = await Solicitacao.findById(`${cpf}_${hoje}`).lean();

        res.json({
            historico: historico,
            queixa_atual: solicitacao ? solicitacao.queixa_motivo : ""
        });
    } catch (err) {
        res.status(500).json({ historico: [], queixa_atual: "" });
    }
};