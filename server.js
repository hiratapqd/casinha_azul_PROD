require('dotenv').config();
const express = require('express');
const path = require('path');
const connectDB = require('./src/config/db'); // Importa o novo módulo de conexão

// Importação das Rotas (que criaremos nos próximos passos)
const indexRoutes = require('./src/routes/indexRoutes');

const app = express();

// --- 1. CONEXÃO COM O BANCO ---
connectDB();

// --- 2. CONFIGURAÇÕES E MIDDLEWARES ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- 3. MIDDLEWARE DE TERAPIAS (COM FALLBACK) ---
app.use(async (req, res, next) => {
    try {
        const mongoose = require('mongoose');
        const db = mongoose.connection.db;
        let terapiasAtivas = [];

        if (db) {
            terapiasAtivas = await db.collection("terapias").find({ ativa: true }).sort({ ordem: 1 }).toArray();
        }
        
        if (!terapiasAtivas || terapiasAtivas.length === 0) {
            terapiasAtivas = [
                { nome: "Apometria", slug: "apometrico" },
                { nome: "Reiki", slug: "reiki" },
                { nome: "Aurículo", slug: "auriculo" },
                { nome: "Homeopatia", slug: "homeopatia" }
            ];
        }
        res.locals.terapias = terapiasAtivas;
        next();
    } catch (err) {
        res.locals.terapias = [];
        next();
    }
});

// --- 4. DEFINIÇÃO DE ROTAS ---
// Centralizando as rotas no arquivo de rotas que iniciamos
app.use('/', indexRoutes);

// --- 5. INICIALIZAÇÃO ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor voando baixo em http://localhost:${PORT}`);
    console.log(`📡 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});