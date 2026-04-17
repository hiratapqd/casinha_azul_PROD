const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://casinhaazul_db_user:w05yl31aajDQa3Bz@casinhaazulclr.yarm4jv.mongodb.net/?appName=casinhaazulclr";
const client = new MongoClient(uri);
const dbName = "casinha_azul";

async function populateDB() {
  try {
    await client.connect();
    const db = client.db(dbName);

    // Limpa a collection de atendimentos antes de popular para evitar lixo
    await db.collection('atendimento').deleteMany({});

    const assistidos = Array.from({ length: 10 }, (_, i) => ({
      _id: `cpf_00${i + 1}`, // Aqui o CPF é o ID ÚNICO
      nome: `Assistido Exemplo ${i + 1}`,
      telefone: 11900000000 + i,
      email: `assistido${i + 1}@email.com`
    }));

   
// --- 6. ATENDIMENTOS (Com Datas Retroativas: Hoje, -7, -14 e -21 dias) ---
    const atendimentos = [];
    const hoje = new Date();
    const seteDiasAtras = new Date(hoje.getTime() - (7 * 24 * 60 * 60 * 1000));
    const quatorzeDiasAtras = new Date(hoje.getTime() - (14 * 24 * 60 * 60 * 1000));
    const vinteUmDiasAtras = new Date(hoje.getTime() - (21 * 24 * 60 * 60 * 1000));
    const vinteoitoDiasAtras = new Date(hoje.getTime() - (28 * 24 * 60 * 60 * 1000));
    const trintaCincoDiasAtras = new Date(hoje.getTime() - (35 * 24 * 60 * 60 * 1000));
    const quarentaeDoisDiasAtras = new Date(hoje.getTime() - (42 * 24 * 60 * 60 * 1000));

    // 4 assistidos: 1 Apometria (há 21 dias) + 3 Reiki/Auriculo (distribuídos)
    assistidos.slice(0, 4).forEach(a => {
      // Apometria há 21 dias
      atendimentos.push({ 
        cpf_assistido: a._id, tipo: "apometrico", data: vinteUmDiasAtras, voluntario: "Marcos", observacoes: "Atendimento inicial de Apometria." 
      });

      // Reiki e Aurículo em datas diferentes para criar histórico
      atendimentos.push({ cpf_assistido: a._id, tipo: "reiki", data: quatorzeDiasAtras, voluntario: "Luciana", observacoes: "Equilíbrio energético." });
      atendimentos.push({ cpf_assistido: a._id, tipo: "auriculo", data: quatorzeDiasAtras, voluntario: "Luciana", observacoes: "Equilíbrio energético." });
      atendimentos.push({ cpf_assistido: a._id, tipo: "reiki", data: seteDiasAtras, voluntario: "Luciana", observacoes: "Manutenção." });
      atendimentos.push({ cpf_assistido: a._id, tipo: "auriculo", data: seteDiasAtras, voluntario: "Luciana", observacoes: "Manutenção." });
      atendimentos.push({ cpf_assistido: a._id, tipo: "reiki", data: hoje, voluntario: "Luciana", observacoes: "Pontos de ansiedade." });
      atendimentos.push({ cpf_assistido: a._id, tipo: "auriculo", data: hoje, voluntario: "Luciana", observacoes: "Pontos de ansiedade." });
    });

    // 4 assistidos: 2 Apometrias (há 21 e 14 dias) + 6 Reiki/Auriculo
    assistidos.slice(4, 8).forEach(a => {
    atendimentos.push({ cpf_assistido: a._id, tipo: "apometrico", data: quarentaeDoisDiasAtras, voluntario: "Marcos", observacoes: "Limpeza inicial." });
    atendimentos.push({ cpf_assistido: a._id, tipo: "apometrico", data: quatorzeDiasAtras, voluntario: "Marcos", observacoes: "Reforço apométrico." });
    atendimentos.push({ cpf_assistido: a._id, tipo: "auriculo", data: trintaCincoDiasAtras, voluntario: "Luciana", observacoes: "Acompanhamento." });
    atendimentos.push({ cpf_assistido: a._id, tipo: "reiki", data: trintaCincoDiasAtras, voluntario: "Luciana", observacoes: "Sessão atual." });
    atendimentos.push({ cpf_assistido: a._id, tipo: "auriculo", data: vinteoitoDiasAtras, voluntario: "Luciana", observacoes: "Acompanhamento." });
    atendimentos.push({ cpf_assistido: a._id, tipo: "reiki", data: vinteoitoDiasAtras, voluntario: "Luciana", observacoes: "Sessão atual." });
    atendimentos.push({ cpf_assistido: a._id, tipo: "auriculo", data: vinteUmDiasAtras, voluntario: "Luciana", observacoes: "Acompanhamento." });
    atendimentos.push({ cpf_assistido: a._id, tipo: "reiki", data: vinteUmDiasAtras, voluntario: "Luciana", observacoes: "Sessão atual." });
    atendimentos.push({ cpf_assistido: a._id, tipo: "auriculo", data: quatorzeDiasAtras, voluntario: "Luciana", observacoes: "Acompanhamento." });
    atendimentos.push({ cpf_assistido: a._id, tipo: "reiki", data: quatorzeDiasAtras, voluntario: "Luciana", observacoes: "Sessão atual." });
    atendimentos.push({ cpf_assistido: a._id, tipo: "auriculo", data: seteDiasAtras, voluntario: "Luciana", observacoes: "Acompanhamento." });
    atendimentos.push({ cpf_assistido: a._id, tipo: "reiki", data: seteDiasAtras, voluntario: "Luciana", observacoes: "Sessão atual." });
    atendimentos.push({ cpf_assistido: a._id, tipo: "auriculo", data: hoje, voluntario: "Luciana", observacoes: "Acompanhamento." });
    atendimentos.push({ cpf_assistido: a._id, tipo: "reiki", data: hoje, voluntario: "Luciana", observacoes: "Sessão atual." });
    });

    // 2 assistidos: 1 Apometria (Há 21 dias)
    assistidos.slice(8, 10).forEach(a => {
      atendimentos.push({ cpf_assistido: a._id, tipo: "apometrico", data: vinteUmDiasAtras, voluntario: "Marcos", observacoes: "Primeiro contato e anamnese." });
    });

    await db.collection('atendimento').insertMany(atendimentos);
    console.log(`Sucesso! Foram inseridos ${atendimentos.length} atendimentos vinculados pelos CPFs.`);

  } catch (err) {
    console.error("Erro ao popular banco:", err);
  } finally {
    await client.close();
  }
}

populateDB();