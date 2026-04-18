const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
    } catch (err) {
        const agora = new Date().toLocaleString('pt-BR');
        console.error(`[${agora}] Erro critico na conexao com MongoDB:`, err.message);

        process.exit(1);
    }
};

module.exports = connectDB;
