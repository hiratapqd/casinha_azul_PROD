const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

// Função para obter o cliente (similar ao get_mongo_client)
function getMongoClient() {
    return new MongoClient(uri, {
        serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
        }
    });
}

// Lista todas as bases e suas coleções
async function listCollections(databaseName = null) {
    const client = getMongoClient();
    try {
        await client.connect();
        
        if (databaseName) {
            const db = client.db(databaseName);
            const collections = await db.listCollections().toArray();
            return collections.map(col => col.name);
        }

        const admin = client.db().admin();
        const { databases } = await admin.listDatabases();
        const collectionsByDatabase = {};

        for (const dbInfo of databases) {
            const db = client.db(dbInfo.name);
            const collections = await db.listCollections().toArray();
            collectionsByDatabase[dbInfo.name] = collections.map(col => col.name);
        }

        return collectionsByDatabase;
    } finally {
        await client.close();
    }
}

// Busca todos os documentos (similar ao get_all_documents)
async function getAllDocuments(collectionName = "terapias", databaseName = "casinha_azul") {
    const client = getMongoClient();
    try {
        await client.connect();
        const db = client.db(databaseName);
        const collection = db.collection(collectionName);
        
        // .find({}).toArray() equivale ao list(collection.find({})) do Python
        const documents = await collection.find({}).toArray();
        return documents;
    } finally {
        await client.close();
    }
}

// Função Principal (Equivalente ao if __name__ == '__main__':)
 async function main() {
    try {
        console.log("--- Estrutura do Cluster ---");
        const estrutura = await listCollections();
        console.log(JSON.stringify(estrutura, null, 2));

        console.log("\n--- Documentos em 'terapias' ---");
        const docs = await getAllDocuments();
        console.dir(docs, { depth: null, colors: true });
        
    } catch (error) {
        console.error("Erro na execução:", error);
    }
}

main()