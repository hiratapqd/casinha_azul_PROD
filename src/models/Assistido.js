const mongoose = require('mongoose');

/**
 * Schema para o Cadastro de Assistidos
 * O CPF é utilizado como _id (chave primária) para evitar duplicidade 
 * e servir de referência única para os atendimentos.
 */
const assistidoSchema = new mongoose.Schema({
    _id: { 
        type: String, 
        required: true,
        description: "CPF do assistido (apenas números)" 
    },
    nome: { 
        type: String, 
        required: true, 
        trim: true 
    },
    telefone: { 
        type: String, 
        trim: true 
    },
    email: { 
        type: String, 
        lowercase: true, 
        trim: true 
    },
    dataNascimento: {
        type: Date
    },
    observacoesGerais: {
        type: String
    },
    dataCadastro: { 
        type: Date, 
        default: Date.now 
    },
    status: {
        type: String,
        enum: ['Ativo', 'Inativo'],
        default: 'Ativo'
    }
}, { 
    versionKey: false // Remove o campo __v padrão do MongoDB
});

// Exporta o modelo como 'Assistido'
module.exports = mongoose.model('Assistido', assistidoSchema);