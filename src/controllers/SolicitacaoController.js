// src/controllers/SolicitacaoController.js
const Solicitacao = require('../models/Solicitacao');
const Assistido = require('../models/Assistido');
const LimiteAtendimento = require('../models/LimiteAtendimento');

exports.criarSolicitacaoComCadastro = async (req, res) => {

    try {
const dados = req.body;
        const tipoParaBusca = "apometria";

        // 1. DATA DE AGORA EM BRASÍLIA (Para registrar o momento exato do pedido)
        const agoraUTC = new Date();
        const brasiliaTime = new Date(agoraUTC.getTime() - (3 * 60 * 60 * 1000));

        // 2. DATA DO ATENDIMENTO (Vinda do formulário: YYYY-MM-DD)
        const hojeInicio = new Date(dados.data + "T00:00:00-03:00");
        const hojeFim = new Date(dados.data + "T23:59:59-03:00");

        // 3. BUSCAR LIMITES DINÂMICOS
        const diasSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
        const dataReferencia = new Date(dados.data + "T12:00:00"); 
        const diaNome = diasSemana[dataReferencia.getDay()];
        const configLimite = await LimiteAtendimento.findOne({ tipo: tipoParaBusca });
        
        let limitePrincipal = 0;
        let limiteEspera = 0;

        if (configLimite) {
            if (configLimite.limites && configLimite.limites[diaNome] !== undefined) {
                limitePrincipal = configLimite.limites[diaNome];
                console.log(`✅ Sucesso! Capturado limite de ${diaNome}: ${limitePrincipal}`);
            } 
            else if (configLimite.limite_principal !== undefined) {
                limitePrincipal = configLimite.limite_principal;
                console.log(`ℹ️ Limite do dia não definido, usando limite_principal: ${limitePrincipal}`);
            }

            limiteEspera = configLimite.limite_espera || 0;
        } else {
            console.log("⚠️ Nenhuma configuração encontrada no banco. Usando padrão zero.");
            limitePrincipal = 8; 
        }
        const limiteTotal = limitePrincipal + limiteEspera;

        const dataBase = dados.data; 
        const totalHoje = await Solicitacao.countDocuments({
            tipo: tipoParaBusca, 
            data_pedido: { 
                $gte: hojeInicio, 
                $lte: hojeFim 
            }
        });
        
        console.log("📊 Configuração encontrada no banco:", configLimite);
        console.log(`🔎 Filtro: ${tipoParaBusca} entre ${dataBase}T00:00 e 23:59`);
        console.log(`Contagem para ${dataBase}: ${totalHoje} de ${limiteTotal}`);

        if (totalHoje >= limiteTotal) {
            console.log(`🚫 Limite atingido para ${diaNome}: ${totalHoje}/${limiteTotal}`);
            
            return res.json({ 
                status: 'limite_excedido', 
                mensagem: `O limite de atendimentos para ${diaNome} (${limiteTotal} vagas) já foi alcançado.` 
            });
        }
        
        const nasc = new Date(dados.data_nascimento);
        let idade = agoraUTC.getFullYear() - nasc.getFullYear();
        if (brasiliaTime < new Date(brasiliaTime.getFullYear(), nasc.getMonth(), nasc.getDate())) {
            idade--;
        }

 
        await Assistido.findByIdAndUpdate(
            dados.cpf_assistido,
            {
                nome_assistido: dados.nome,
                telefone_assistido: dados.telefone,
                data_nascimento_assistido: dados.data_nascimento,
                sexo_assistido: dados.sexo,
                religiao_assistido: dados.religiao,
                cidade_assistido: dados.cidade,
                uf_assistido: dados.uf,
                email_assistido: dados.email,
                status: "Ativo"
            },
            { upsert: true, returnDocument: 'after' }
        );


        const idSolicitacao = `${dados.cpf_assistido}_${dados.data}`;
        
        const contagem = await Solicitacao.countDocuments({ 
            data_pedido: { $gte: hojeInicio },
            tipo: tipoParaBusca 
        });
        
        const posicaoFila = contagem + 1;

        if (posicaoFila > limiteTotal) {
            return res.json({ 
                status: 'bloqueado', 
                mensagem: `O limite de ${limiteTotal} vagas para ${tipoParaBusca} hoje foi atingido.` 
            });
        }

        const novaPosicao = totalHoje + 1;
        const statusFinal = novaPosicao <= limitePrincipal ? 'Confirmado' : 'Lista de Espera';

        const novaSolicitacao = new Solicitacao({
            _id: idSolicitacao,
            nome_assistido: dados.nome,
            idade_assistido: idade,
            sendo_atendido: dados.atendimento_por,
            queixa_motivo: dados.queixa,
            posicao: totalHoje + 1,
            data_pedido: brasiliaTime,
            tipo: tipoParaBusca,
            status: (totalHoje + 1) <= limitePrincipal ? 'Confirmado' : 'Espera'
        });

        try {
            await novaSolicitacao.save();
            
            return res.json({
                status: 'sucesso',
                mensagem: 'Solicitação registrada!',
                posicao: novaPosicao,
                limite: limitePrincipal
            });
        } catch (erroSave) {
            if (erroSave.code === 11000) {
                return res.json({ 
                    status: 'duplicado', 
                    mensagem: 'Este CPF já possui uma solicitação para este dia.' 
                });
            }

            return res.status(500).json({ status: 'erro', mensagem: erroSave.message });
        }
        
        await novaSolicitacao.save();
        
        res.json({ 
            status: 'sucesso', 
            posicao: posicaoFila, 
            limite: limitePrincipal 
        });

    } catch (err) {
        if (err.code === 11000) {
            return res.json({ status: 'duplicado', mensagem: 'O assistido já possui uma solicitação hoje.' });
        }
        res.status(500).json({ status: 'erro', mensagem: err.message });
    }
};
exports.buscarHistorico = async (req, res) => {
    try {
        const { cpf } = req.params;
        const historico = await Solicitacao.find({ _id: new RegExp(`^${cpf}`) })
            .sort({ data_pedido: -1 })
            .limit(12);
        res.json(historico);
    } catch (err) {
        res.status(500).json([]);
    }
};

exports.getFilaHoje = async (req, res) => {
    try {
        const hojeInicio = new Date();
        hojeInicio.setHours(0, 0, 0, 0);

        const hojeFim = new Date();
        hojeFim.setHours(23, 59, 59, 999);

        const solicitacoes = await Solicitacao.find({
            data_pedido: { $gte: hojeInicio, $lte: hojeFim }
        }).sort({ data_pedido: 1 }); 

        res.render('fila_atendimento', { solicitacoes });
    } catch (error) {
        console.error("Erro ao buscar fila:", error);
        res.status(500).send("Erro ao carregar a fila.");
    }
};

exports.iniciarAtendimento = async (req, res) => {
    try {
        const { id } = req.params; // Aqui virá o seu 'cpf_001_...'
        
        // Usamos findOneAndUpdate porque o seu _id é uma String customizada
        await Solicitacao.findOneAndUpdate(
            { _id: id }, 
            { status: 'Em Atendimento' }
        );
        
        res.redirect('/fila-atendimento');
    } catch (err) {
        console.error("Erro ao iniciar atendimento:", err);
        res.status(500).send("Erro ao atualizar status.");
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
        console.error("Erro ao cancelar solicitação:", err);
        res.status(500).send("Erro ao processar o cancelamento.");
    }
};