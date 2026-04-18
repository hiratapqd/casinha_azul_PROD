require('dotenv').config();
const express = require('express');
const path = require('path');
const connectDB = require('./src/config/db');
const app = express();

const indexRoutes = require('./src/routes/indexRoutes');

connectDB();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(async (req, res, next) => {
    try {
        const mongoose = require('mongoose');
        const db = mongoose.connection.db;
        let terapiasAtivas = [];

        if (db) {
            terapiasAtivas = await db.collection('terapias')
                .find({ ativa: true })
                .sort({ ordem: 1 })
                .toArray();
        }

        if (!terapiasAtivas || terapiasAtivas.length === 0) {
            terapiasAtivas = [
                { nome: 'Apometria', slug: 'apometria' },
                { nome: 'Reiki', slug: 'reiki' },
                { nome: 'Auriculo', slug: 'auriculo' }
            ];
        }

        res.locals.terapias = terapiasAtivas;
        next();
    } catch (err) {
        console.error('Erro no middleware de terapias:', err);
        res.locals.terapias = [];
        next();
    }
});

app.use('/', indexRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT);
