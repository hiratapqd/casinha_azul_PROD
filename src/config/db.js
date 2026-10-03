const mongoose = require('mongoose');
const { formatarDataHora } = require('../utils/operacao');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
    } catch (err) {
        const agora = formatarDataHora(new Date());
        console.error(`[${agora}] Erro critico na conexao com MongoDB:`, err.message);

        process.exit(1);
    }
};

module.exports = connectDB;
