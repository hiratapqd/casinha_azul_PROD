const Atendimento = require('../models/Atendimento');
const Assistido = require('../models/Assistido');

exports.getAtendimentosHoje = async (req, res) => {
    try {
        // 1. Ajuste de fuso horário para Brasília
        const agora = new Date();
        const offsetBrasilia = -3;
        const dataBrasilia = new Date(agora.getTime() + (offsetBrasilia * 60 * 60 * 1000));
        const hojeString = dataBrasilia.toISOString().split('T')[0];

        // 2. Início e fim do dia real para a busca
        const hojeInicio = new Date(`${hojeString}T00:00:00-03:00`);
        const hojeFim = new Date(`${hojeString}T23:59:59-03:00`);

        //console.log(`🔎 Buscando atendimentos entre: ${hojeInicio} e ${hojeFim}`);

        const atendimentos = await Atendimento.find({
            data: { $gte: hojeInicio, $lte: hojeFim }
        }).sort({ data: -1 }).lean();

        // 3. Inicialização dos contadores (Slugs padronizados)
        const counts = {
            reiki: 0,
            apometria: 0,
            auriculo: 0,
            passe: 0,
            maos_sem_fronteiras: 0,
            homeopatia: 0
        };

        // 4. Contagem com normalização de texto
        atendimentos.forEach(a => {
            const tipoNormalizado = a.tipo ? a.tipo.trim().toLowerCase() : "";
            if (counts.hasOwnProperty(tipoNormalizado)) {
                counts[tipoNormalizado]++;
            }
        });

        // console.log("📊 Contagem final enviada ao EJS:", counts);

        // 5. Definição das abas (O slug deve ser igual à chave do 'counts')
        const tabs = [
            { slug: '__todos', nome: 'Todos' },
            { slug: 'reiki', nome: 'Reiki' },
            { slug: 'apometria', nome: 'Apometria' },
            { slug: 'auriculo', nome: 'Aurículo' },
            { slug: 'passe', nome: 'Passe' },
            { slug: 'maos_sem_fronteiras', nome: 'Mãos sem Fronteiras' },
            { slug: 'homeopatia', nome: 'Homeopatia' }
        ];

        res.render('relatorios/atendimentos_hoje', { 
            atendimentos, 
            counts, 
            tabs,
            hoje: dataBrasilia.toLocaleDateString('pt-BR')
        });

    } catch (err) {
        console.error("❌ Erro no RelatorioController:", err);
        res.status(500).send("Erro ao carregar relatório.");
    }
};
exports.getRelatorioGeralAssistidos = async (req, res) => {
    try {
        const assistidosComAtendimentos = await Assistido.aggregate([
            {
                $lookup: {
                    from: 'atendimentos', 
                    localField: '_id',           // Campo no Assistido (agora é o _id)
                    foreignField: 'cpf_assistido', // Campo no Atendimento
                    as: 'meus_atendimentos'      // Nome temporário da lista
                }
            },
            {
                $project: {
                    // Mapeamos o _id para aparecer como 'cpf' no EJS
                    cpf: "$_id",
                    nome: { $ifNull: ["$nome", "$nome_assistido"] },
                    telefone: { $ifNull: ["$telefone", "$telefone_assistido"] },
                    email: { $ifNull: ["$email", "$email_assistido"] },
                    status: 1,
                    // Extraímos os tipos únicos da lista 'meus_atendimentos'
                    tratamentos: { 
                        $reduce: {
                            input: "$meus_atendimentos.tipo",
                            initialValue: [],
                            in: { $setUnion: ["$$value", ["$$this"]] }
                        }
                    }
                }
            },
            { $sort: { nome: 1 } }
        ]);

        res.render('relatorios/relatorio_assistidos', { assistidos: assistidosComAtendimentos });
    } catch (err) {
        console.error("Erro no Relatório:", err);
        res.status(500).send("Erro ao carregar dados.");
    }
};

exports.getRelatorioVoluntarios = async (req, res) => {
    try {
        const listaVoluntarios = await Atendimento.aggregate([
            {
                $group: {
                    _id: "$voluntario", 
                    totalAtendimentos: { $sum: 1 }, 
                    ultimaParticipacao: { $max: "$data" } 
                }
            },
            { $sort: { totalAtendimentos: -1 } } 
        ]);

       
        res.render('relatorios/relatorio_voluntarios', { 
            voluntarios: listaVoluntarios,
            titulo: "Ranking de Voluntários" 
        });
    } catch (err) {
        console.error("Erro no relatório de voluntários:", err);
        res.status(500).send("Erro ao processar relatório.");
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

/*         const ultimosAtendimentos = await Atendimento.aggregate([
            { $sort: { data: -1 } },
            { $group: {
                _id: "$cpf_assistido",
                nome: { $first: "$nome_assistido" },
                ultimaData: { $first: "$data" },
                ultimoTipo: { $first: "$tipo" }
            }},
            { $match: { 
                ultimoTipo: "apometria",
                ultimaData: { $lte: data30 } 
            }}
        ]); */

        const ultimosAtendimentos = await Atendimento.aggregate([
            {
                $match: {
                    // Agora consideramos AMBOS para saber se a pessoa abandonou a casa
                    tipo: { $in: ["apometria", "passe"] } 
                }
            },
            {
                $group: {
                    _id: "$cpf_assistido",
                    nome: { $first: "$nome_assistido" },
                    // Pegamos a data mais recente entre os dois tipos
                    ultimaData: { $max: "$data" } 
                }
            }
        ]);

        const listas = { d30: [], d60: [], d90: [] };
        const counts = { d30: 0, d60: 0, d90: 0 };

        for (const registro of ultimosAtendimentos) {
            const dataAtendimento = new Date(registro.ultimaData);
            const cpfParaBusca = registro._id;
            // console.log({ cpfParaBusca });
            const dadosCadastrais = await Assistido.findById(cpfParaBusca).lean();
/*             if (!dadosCadastrais) {
                console.log(`⚠️ Atenção: CPF ${cpfParaBusca} não encontrado na collection Assistidos!`);
            } else {
                console.log(`✅ Cadastro encontrado para: ${dadosCadastrais.nome_assistido}`);
            } */
            const item = {
                cpf: cpfParaBusca,
                nome: registro.nome,
                ultimaData: registro.ultimaData,
                telefone: dadosCadastrais ? (dadosCadastrais.telefone_assistido || ""): "Não cadastrado",
                email: dadosCadastrais ? (dadosCadastrais.email_assistido || ""): "Não cadastrado"
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
        console.error("Erro ao calcular inativos:", err);
        res.status(500).send("Erro ao processar inativos.");
    }
};