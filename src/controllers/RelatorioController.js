const Atendimento = require('../models/Atendimento');
const Assistido = require('../models/Assistido');

exports.getAtendimentosHoje = async (req, res) => {
    try {
        const hojeInicio = new Date();
        hojeInicio.setHours(0, 0, 0, 0);

        const hojeFim = new Date();
        hojeFim.setHours(23, 59, 59, 999);

        // Busca atendimentos de hoje
        const atendimentos = await Atendimento.find({
            data: { $gte: hojeInicio, $lte: hojeFim }
        }).sort({ data: -1 });

        // Prepara o objeto de contagem (counts) que o EJS está pedindo
        const counts = {
            reiki: 0,
            apometrico: 0,
            auriculo: 0,
            maos_sem_fronteiras: 0,
            homeopatico: 0,
            passe: 0
        };

        // Soma cada tipo encontrado
        atendimentos.forEach(a => {
            if (counts.hasOwnProperty(a.tipo)) {
                counts[a.tipo]++;
            }
        });

        // Define as abas exatamente como o EJS espera percorrer no loop
        const tabs = [
            { slug: 'reiki', nome: 'Reiki' },
            { slug: 'apometrico', nome: 'Apometria' },
            { slug: 'auriculo', nome: 'Aurículo' },
            { slug: 'maos_sem_fronteiras', nome: 'Mãos sem Fronteiras' },
            { slug: 'homeopatico', nome: 'Homeopático' },
            { slug: 'passe', nome: 'Passe' }
        ];

        // Agora enviamos TUDO: os atendimentos, os counts e as abas
        res.render('relatorios/atendimentos_hoje', { 
            atendimentos, 
            counts, 
            tabs 
        });

    } catch (err) {
        console.error("Erro no relatório de hoje:", err);
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

exports.getApometriaInativos = async (req, res) => {
    try {
        const hoje = new Date();
        
        // Marcos temporais
        const data30 = new Date();
        data30.setDate(hoje.getDate() - 30);
        data30.setHours(23, 59, 59, 999);
        
        const data60 = new Date();
        data60.setDate(hoje.getDate() - 60);
        data60.setHours(23, 59, 59, 999);
        
        const data90 = new Date();
        data90.setDate(hoje.getDate() - 90);
        data90.setHours(23, 59, 59, 999);


        // 1. Agregação para pegar o último atendimento de apometria de cada pessoa
/*         const ultimosAtendimentos = await Atendimento.aggregate([
            { $match: { tipo: 'apometrico' } },
            { $sort: { data: -1 } },
            { $group: {
                _id: "$cpf_assistido",
                ultimaData: { $first: "$data" },
                nome: { $first: "$nome_assistido" }
            }}
        ]); */
        const ultimosAtendimentos = await Atendimento.aggregate([
            { $sort: { data: -1 } },
            { $group: {
                _id: "$cpf_assistido",
                nome: { $first: "$nome_assistido" },
                ultimaData: { $first: "$data" },
                ultimoTipo: { $first: "$tipo" }
            }},
            { $match: { 
                ultimoTipo: "apometria", // Regra: o último foi apometria
                ultimaData: { $lte: data30 } // E faz mais de 30 dias
            }}
        ]);

        // 2. Arrays para as abas (listas) e objeto para os cartões (counts)
        const listas = { d30: [], d60: [], d90: [] };
        const counts = { d30: 0, d60: 0, d90: 0 };

        for (const registro of ultimosAtendimentos) {
            const dataAtendimento = new Date(registro.ultimaData);
            
            const item = {
                cpf: registro._id,
                nome: registro.nome,
                ultimaData: registro.ultimaData,
                // Aqui você pode buscar telefone/email se precisar, 
                // ou deixar vazio se o EJS tratar
                telefone: "", 
                email: ""
            };

            // Lógica de categorização (Quem está há mais tempo sem vir)
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

        // 3. Renderiza enviando 'listas' E 'counts'
        res.render('relatorios/apometria_inativos', { 
            listas, 
            counts 
        });

    } catch (err) {
        console.error("Erro ao calcular inativos:", err);
        res.status(500).send("Erro ao processar inativos.");
    }
};