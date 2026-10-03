require('dotenv').config();
const express = require('express');
const path = require('path');
const connectDB = require('./src/config/db');
const app = express();
const { listarConfiguracoes } = require('./src/services/ConfiguracaoOperacao');
const { MODALIDADES } = require('./src/utils/operacao');

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
        res.locals.terapias = db
            ? (await listarConfiguracoes()).filter(t => t.ativa)
            : MODALIDADES;
        next();
    } catch (err) {
        console.error('Erro no middleware de terapias:', err);
        res.locals.terapias = [];
        next();
    }
});

app.use('/', indexRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Aplicação iniciada com sucesso! Acesse: http://localhost:${PORT}`);
});
