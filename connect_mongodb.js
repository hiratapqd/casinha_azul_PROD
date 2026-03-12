const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = "mongodb+srv://casinhaazul_db_user:bmoaemzDb1pJgqi3@casinhaazulclr.46cdvel.mongodb.net/casinha_azul?retryWrites=true&w=majority";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Conecta ao servidor
    await client.connect();
    
    // Seleciona o banco de dados casinha_azul
    const database = client.db("casinha_azul");
    const colecaoTeste = database.collection("teste_conexao");

    // Envia um ping para confirmar a conexão
    await database.command({ ping: 1 });
    console.log("✅ Ping ok! Conectado com sucesso ao MongoDB.");

    // Insere um documento para "forçar" a criação do database casinha_azul no Atlas
    const resultado = await colecaoTeste.insertOne({ 
        mensagem: "Database inicializado com sucesso!", 
        data: new Date() 
    });

    console.log(`🚀 Database 'casinha_azul' acessado. Documento de teste criado com ID: ${resultado.insertedId}`);

  } catch (error) {
    console.error("❌ Erro ao conectar ou inicializar o banco:", error);
  } finally {
    // Fecha a conexão ao finalizar
    await client.close();
  }
}

run().catch(console.dir);