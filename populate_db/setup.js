require('dotenv').config();
const { MongoClient } = require('mongodb');


// Sua connection string fornecida
//const uri = "mongodb+srv://casinhaazul_db_user:w05yl31aajDQa3Bz@casinhaazulclr.yarm4jv.mongodb.net/?appName=casinhaazulclr";
const MONGODB_URI = process.env.MONGODB_URI;
const client = new MongoClient(MONGODB_URI);

// Nome do banco de dados (ajuste se preferir outro nome)
const dbName = "casinha_azul";

async function run() {
    try {
        await client.connect();
        console.log("Conectado com sucesso ao MongoDB Atlas!");

        const db = client.db(dbName);

        // Lista de collections baseada no seu schema 
        const collections = [
            'assistidos',
            'limite_atendimento',
            'voluntarios',
            'atendimentos',
            'configuracoesfluxo',
            'livros',
            'solicitacoes',
            'terapias',
            'vendas',
            'voluntarios'
        ];

        for (const colName of collections) {
            // O MongoDB cria a collection automaticamente ao inserir dados, 
            // mas podemos forçar a criação explícita aqui:
            const list = await db.listCollections({ name: colName }).toArray();
            if (list.length === 0) {
                await db.createCollection(colName);
                console.log(`Collection '${colName}' criada.`);
            } else {
                console.log(`Collection '${colName}' já existe.`);
            }
        }

        console.log("\nEstrutura inicial do banco preparada com sucesso!");

    } catch (err) {
        console.error("Erro ao conectar ou criar collections:", err);
    } finally {
        await client.close();
    }
}

run();