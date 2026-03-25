const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            maxPoolSize: 10,            
            serverSelectionTimeoutMS: 5000, 
            socketTimeoutMS: 45000,     
        });

        const agora = new Date().toLocaleString('pt-BR');
        console.log(`✅ [${agora}] MongoDB Atlas Conectado: ${conn.connection.host}`);
        console.log(`📂 Database ativa: ${conn.connection.name}`);

    } catch (err) {
        const agora = new Date().toLocaleString('pt-BR');
        console.error(`❌ [${agora}] Erro crítico na conexão com MongoDB:`, err.message);
        
        process.exit(1); 
    }
};

module.exports = connectDB;