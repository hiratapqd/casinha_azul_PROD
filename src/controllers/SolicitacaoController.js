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
        // Precisamos definir o início e fim do dia BASEADO NO FORMULÁRIO para a contagem
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
            // PRIORIDADE 1: O dia da semana dentro do objeto 'limites' (Ex: terca: 4)
            if (configLimite.limites && configLimite.limites[diaNome] !== undefined) {
                limitePrincipal = configLimite.limites[diaNome];
                console.log(`✅ Sucesso! Capturado limite de ${diaNome}: ${limitePrincipal}`);
            } 
            // PRIORIDADE 2: O campo 'limite_principal' da raiz do documento
            else if (configLimite.limite_principal !== undefined) {
                limitePrincipal = configLimite.limite_principal;
                console.log(`ℹ️ Limite do dia não definido, usando limite_principal: ${limitePrincipal}`);
            }

            limiteEspera = configLimite.limite_espera || 0;
        } else {
            console.log("⚠️ Nenhuma configuração encontrada no banco. Usando padrão zero.");
            limitePrincipal = 2; // Opcional: um fallback de segurança
        }
        const limiteTotal = limitePrincipal + limiteEspera;

        // 4. CONTAR ATENDIMENTOS JÁ EXISTENTES PARA O DIA SELECIONADO
        const dataBase = dados.data; // Formato "YYYY-MM-DD"
        const totalHoje = await Solicitacao.countDocuments({
            tipo: tipoParaBusca, // Certifique-se que na collection 'solicitacoes' o campo chama 'tipo'
            data_pedido: { 
                $gte: hojeInicio, 
                $lte: hojeFim 
            }
        });
        
        console.log("📊 Configuração encontrada no banco:", configLimite);
        console.log(`🔎 Filtro: ${tipoParaBusca} entre ${dataBase}T00:00 e 23:59`);
        console.log(`Contagem para ${dataBase}: ${totalHoje} de ${limiteTotal}`);

        // 5. BLOQUEIO DE LIMITE
        if (totalHoje >= limiteTotal) {
            console.log(`🚫 Limite atingido para ${diaNome}: ${totalHoje}/${limiteTotal}`);
            
            // O RETURN aqui é OBRIGATÓRIO para interromper a função
            return res.json({ 
                status: 'limite_excedido', 
                mensagem: `O limite de atendimentos para ${diaNome} (${limiteTotal} vagas) já foi alcançado.` 
            });
        }
        
        // 6. Cálculo da Idade do Assistido
        const nasc = new Date(dados.data_nascimento);
        let idade = agoraUTC.getFullYear() - nasc.getFullYear();
        if (brasiliaTime < new Date(brasiliaTime.getFullYear(), nasc.getMonth(), nasc.getDate())) {
            idade--;
        }

 
        // 7. Gravar/Atualizar Assistido
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


        // 8. Lógica de Fila baseada no Tipo 
        const idSolicitacao = `${dados.cpf_assistido}_${dados.data}`;
        
        const contagem = await Solicitacao.countDocuments({ 
            data_pedido: { $gte: hojeInicio },
            tipo: tipoParaBusca 
        });
        
        const posicaoFila = contagem + 1;

        // VERIFICAÇÃO DE BLOQUEIO TOTAL
        if (posicaoFila > limiteTotal) {
            return res.json({ 
                status: 'bloqueado', 
                mensagem: `O limite de ${limiteTotal} vagas para ${tipoParaBusca} hoje foi atingido.` 
            });
        }

        // 9. CRIAR O OBJETO PARA SALVAR
        const novaPosicao = totalHoje + 1;
        const statusFinal = novaPosicao <= limitePrincipal ? 'Confirmado' : 'Lista de Espera';
        // console.log(`💾 Tentando gravar para o dia ${dados.data}. Posição: ${novaPosicao}`);

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

        // console.log(`💾 Tentando gravar posição ${totalHoje + 1} no Horário Brasília...`);
        // console.log(`💾 Tentando salvar: ${novaSolicitacao._id} como ${statusFinal}`);


        try {
            await novaSolicitacao.save();
            // console.log("✅ Gravado com sucesso no MongoDB!");
            
            return res.json({
                status: 'sucesso',
                mensagem: 'Solicitação registrada!',
                posicao: novaPosicao,
                limite: limitePrincipal
            });
        } catch (erroSave) {
            // console.error("❌ ERRO AO GRAVAR NO BANCO:", erroSave.message);
            
            // Se o erro for código 11000, é CPF duplicado no mesmo dia
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

        // Alterado de 'data' para 'data_pedido' para coincidir com o que é salvo
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
        const { id } = req.params; // Recebe o ID (CPF_DATA)
        
        // Atualiza o status para 'Cancelado' na collection 'solicitacoes' 
        await Solicitacao.findOneAndUpdate(
            { _id: id }, 
            { status: 'Cancelado' }
        );
        
        // Redireciona de volta para a fila atualizada
        res.redirect('/fila-atendimento');
    } catch (err) {
        console.error("Erro ao cancelar solicitação:", err);
        res.status(500).send("Erro ao processar o cancelamento.");
    }
};