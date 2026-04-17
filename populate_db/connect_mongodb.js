require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

async function testConnection() {
    try {
        // 1. Tenta conectar
        await mongoose.connect(MONGODB_URI, { 
            serverSelectionTimeoutMS: 5000 // Desiste após 5s se a VM estiver offline
        });
        
        console.log("Sucesso: MongoDB conectado no Rocky Linux!");
        console.log(`Host: ${mongoose.connection.host}`);
        console.log(`Database: ${mongoose.connection.name}`);

    } catch (err) {
        console.error("❌ Erro de Conexão:");
        console.error(err.message);
    } finally {
        await mongoose.connection.close();
        console.log("Conexão encerrada. Script finalizado.");
        process.exit(0);
    }
}

testConnection();