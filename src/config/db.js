const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Busca a URI do seu arquivo .env
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            // Configurações recomendadas para estabilidade e performance
            maxPoolSize: 10,             // Limite de conexões simultâneas
            serverSelectionTimeoutMS: 5000, // Tempo de espera antes de dar erro de timeout
            socketTimeoutMS: 45000,      // Fecha sockets inativos após 45s
        });

        const agora = new Date().toLocaleString('pt-BR');
        console.log(`✅ [${agora}] MongoDB Atlas Conectado: ${conn.connection.host}`);
        console.log(`📂 Database ativa: ${conn.connection.name}`);

    } catch (err) {
        const agora = new Date().toLocaleString('pt-BR');
        console.error(`❌ [${agora}] Erro crítico na conexão com MongoDB:`, err.message);
        
        // Em produção, é melhor encerrar o processo se o banco não conectar
        process.exit(1); 
    }
};

module.exports = connectDB;