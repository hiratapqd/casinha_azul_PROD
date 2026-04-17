const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://casinhaazul_db_user:w05yl31aajDQa3Bz@casinhaazulclr.yarm4jv.mongodb.net/?appName=casinhaazulclr";
const client = new MongoClient(uri);
const dbName = "casinha_azul";

async function populateDB() {
  try {
    await client.connect();
    const db = client.db(dbName);
        // --- 1. LIVRARIA (Dados da Imagem) ---
    const livros = [
      { _id: "9780964990708", Título: "O livro dos espíritos", autor: "Allan Kardec", "ditado por": "", editora: "FEB", valor_compra: "10", valor_venda: "20" },
      { _id: "9788573284836", Título: "o livro dos mediuns", autor: "Allan Kardec", "ditado por": "", editora: "FEB", valor_compra: "11", valor_venda: "22" },
      { _id: "9788573286946", Título: "Evangelho segundo o espiritismo", autor: "Allan Kardec", "ditado por": "", editora: "FEB", valor_compra: "12", valor_venda: "24" },
      { _id: "9788573286670", Título: "Nosso Lar", autor: "Chico Xavier", "ditado por": "André Luiz", editora: "FEB", valor_compra: "13", valor_venda: "26" },
      { _id: "9788573288018", Título: "Missionarios da Luz", autor: "Chico Xavier", "ditado por": "André Luiz", editora: "FEB", valor_compra: "14", valor_venda: "28" },
      { _id: "9788573288049", Título: "Evolução em Dois Mundos", autor: "Chico Xavier", "ditado por": "André Luiz", editora: "FEB", valor_compra: "15", valor_venda: "30" }
    ];

    // ---2. VOLUNTÁRIOS ---
    const voluntarios = [
      { 
        _id: "12345678901", 
        nome: "Marcos Terapeuta", 
        telefone: 11999998888, 
        email: "marcos@casinhaazul.org", 
        disponibilidade: "Sábados", 
        esta_ativo: "Sim", 
        data_cadastro_voluntario: "2024-01-10", 
        data_efetivacao: "2024-02-01" 
      },
      { 
        _id: "98765432100", 
        nome: "Luciana Reiki", 
        telefone: 11977776666, 
        email: "luciana@casinhaazul.org", 
        disponibilidade: "Quartas", 
        esta_ativo: "Sim", 
        data_cadastro_voluntario: "2024-01-15", 
        data_efetivacao: "2024-02-15" 
      }
    ];

    // --- 3. LIMITE DE ATENDIMENTO ---
    const limites = [
      { terapia: "Apometria", dia_semana: "Segunda-feira", qtos_atendimentos: "12" },
      { terapia: "Apometria", dia_semana: "Quarta-feira", qtos_atendimentos: "12" },
      { terapia: "Apometria", dia_semana: "Quinta-feira", qtos_atendimentos: "16" },
      { terapia: "Apometria", dia_semana: "Sábado", qtos_atendimentos: "20" },
      { terapia: "Apometria", dia_semana: "Domingo", qtos_atendimentos: "20" },
      { terapia: "Reiki", dia_semana: "Segunda-feira", qtos_atendimentos: "30" },
      { terapia: "Reiki", dia_semana: "Quarta-feira", qtos_atendimentos: "30" },
      { terapia: "Reiki", dia_semana: "Quinta-feira", qtos_atendimentos: "30" },
      { terapia: "Reiki", dia_semana: "Sábado", qtos_atendimentos: "30" },
      { terapia: "Reiki", dia_semana: "Domingo", qtos_atendimentos: "30" },
      { terapia: "Auriculo", dia_semana: "Segunda-feira", qtos_atendimentos: "30" },
      { terapia: "Auriculo", dia_semana: "Quarta-feira", qtos_atendimentos: "30" },
      { terapia: "Auriculo", dia_semana: "Quinta-feira", qtos_atendimentos: "30" },
      { terapia: "Auriculo", dia_semana: "Sábado", qtos_atendimentos: "30" },
      { terapia: "Auriculo", dia_semana: "Domingo", qtos_atendimentos: "30" },
      { terapia: "Mãos_Sem_Fronteiras", dia_semana: "Terça-feira", qtos_atendimentos: "30" },
      { terapia: "Homeopatico", dia_semana: "Sabado", qtos_atendimentos: "0" }
    ];

    // --- 4. ITENS CANTINA ---
    const itensCantina = [
      { descricao: "Água Mineral 500ml", quantidade: "50", tipo: "Bebida", valor_compra: "1.50", valor_venda: "3.00" },
      { descricao: "Pão de Queijo", quantidade: "30", tipo: "Salgado", valor_compra: "2.00", valor_venda: "5.00" },
      { descricao: "Suco de Uva", quantidade: "20", tipo: "Bebida", valor_compra: "3.00", valor_venda: "6.00" }
    ];

    // --- 5. ASSISTIDOS (10 registros) ---
    const assistidos = Array.from({ length: 10 }, (_, i) => ({
      _id: `cpf_00${i + 1}`,
      nome: `Assistido Exemplo ${i + 1}`,
      telefone: 11900000000 + i,
      email: `assistido${i + 1}@email.com`
    }));
    
// ... (mantenha o início do arquivo igual até a parte dos atendimentos)
// --- 6. ATENDIMENTOS (Com Datas Retroativas) ---
    const atendimentos = [];
    const hoje = new Date();
    const seteDiasAtras = new Date(hoje.getTime() - (7 * 24 * 60 * 60 * 1000));
    const quatorzeDiasAtras = new Date(hoje.getTime() - (14 * 24 * 60 * 60 * 1000));

    // 4 assistidos: 1 Apometria + 3 Reiki/Auriculo
    assistidos.slice(0, 4).forEach(a => {
      // Apometria hoje
      atendimentos.push({ 
        cpf_assistido: a._id, tipo: "apometrico", data: hoje, voluntario: "Marcos", observacoes: "Atendimento inicial." 
      });

      // Reiki há 7 dias
      atendimentos.push({ 
        cpf_assistido: a._id, tipo: "reiki", data: seteDiasAtras, voluntario: "Luciana", observacoes: "Equilíbrio." 
      });

      // Aurículo há 14 dias
      atendimentos.push({ 
        cpf_assistido: a._id, tipo: "auriculo", data: quatorzeDiasAtras, voluntario: "Luciana", observacoes: "Ansiedade." 
      });
    });

    // 4 assistidos: 2 Apometrias + 6 Reiki/Auriculo
    assistidos.slice(4, 8).forEach(a => {
      atendimentos.push({ cpf_assistido: a._id, tipo: "apometrico", data: hoje, voluntario: "Marcos", observacoes: "Reforço." });
      atendimentos.push({ cpf_assistido: a._id, tipo: "apometrico", data: seteDiasAtras, voluntario: "Marcos", observacoes: "Limpeza." });
      
      // Distribuindo 6 sessões entre as 3 datas para variar o histórico
      for(let i=0; i<2; i++) {
          atendimentos.push({ cpf_assistido: a._id, tipo: "reiki", data: hoje, voluntario: "Luciana", observacoes: "Sessão 1." });
          atendimentos.push({ cpf_assistido: a._id, tipo: "reiki", data: seteDiasAtras, voluntario: "Luciana", observacoes: "Sessão 2." });
          atendimentos.push({ cpf_assistido: a._id, tipo: "reiki", data: quatorzeDiasAtras, voluntario: "Luciana", observacoes: "Sessão 3." });
      }
    });

    // 2 assistidos: 1 Apometria (Há 14 dias)
    assistidos.slice(8, 10).forEach(a => {
      atendimentos.push({ cpf_assistido: a._id, tipo: "apometrico", data: quatorzeDiasAtras, voluntario: "Marcos", observacoes: "Primeiro contato." });
    });
    
    // --- EXECUÇÃO DAS INSERÇÕES ---
    // Limpa a coleção antes de inserir para não duplicar lixo
    await db.collection('atendimento').deleteMany({}); 
    
    await db.collection('voluntarios').insertMany(voluntarios);
    await db.collection('limite_atendimento').insertMany(limites);
    await db.collection('atendimento').insertMany(atendimentos); // Nome da coleção: atendimento
    await db.collection('assistidos').insertMany(assistidos);
    await db.collection('livros').insertMany(livros);

    console.log("✅ Banco de dados casinha_azul populado com sucesso!");

  } catch (err) {
    console.error("Erro ao popular banco:", err);
  } finally {
    await client.close();
  }
}

populateDB();