const Voluntario = require('../models/Voluntario');

exports.criarVoluntario = async (req, res) => {
    try {
        const dados = req.body;
        // console.log("Dados recebidos no servidor:", dados); // Verifique o terminal do VS Code!

        // Se o CPF já existir e NÃO for uma atualização forçada, avisamos o front
        const existe = await Voluntario.findById(dados.cpf);
        if (existe && dados.forceUpdate !== 'true') {
            return res.json({ status: 'conflito', mensagem: 'CPF já cadastrado' });
        }

        // 1. Tratamento para atualização (forceUpdate)
        if (dados.forceUpdate === 'true' || dados.forceUpdate === true) {
            await Voluntario.findByIdAndDelete(dados.cpf);
        }

        // 2. Criando o objeto com os nomes exatos vindos do EJS
        const novoVoluntario = new Voluntario({
            _id: dados.cpf, 
            nome: dados.nome,
            telefone: dados.telefone,
            email: dados.email,
            mediunidade: dados.mediunidade,
            esta_ativo: "Sim",
            disponibilidade: {
                // Aqui garantimos que pegamos o array enviado pelo Fetch
                apometria: dados.disp_apometria || [],
                reiki: dados.disp_reiki || [],
                auriculo: dados.disp_auriculo || [],
                maos: dados.disp_maos || [],
                homeopatia: dados.disp_homeopatia || [],
                passe: dados.disp_passe || [],
                cantina: dados.disp_cantina || [],
                mesa: dados.disp_mesa || []
            }
        });

        await novoVoluntario.save();
        res.json({ status: 'sucesso', acao: 'gravado' });

        } catch (err) {
            if (err.code === 11000) {
                return res.json({ status: 'conflito', mensagem: "CPF já cadastrado." });
            }
            console.error("Erro ao salvar:", err);
            res.status(500).json({ status: 'erro', mensagem: err.message });
        }
};

exports.getVisualizarVoluntarios = async (req, res) => {
    try {
        const filtros = { dia: req.query.dia || '', terapia: req.query.terapia || '' };
        const voluntarios = await Voluntario.find().sort({ nome: 1 });
        
        // Enviamos 'filtros' para o EJS não dar erro de "not defined"
        res.render('visualizar_voluntarios', { voluntarios, filtros });
    } catch (err) {
        res.status(500).send("Erro ao carregar lista.");
    }
};