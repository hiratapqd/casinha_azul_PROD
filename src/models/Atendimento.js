const mongoose = require('mongoose');

const AtendimentoSchema = new mongoose.Schema({
    data: { type: Date, required: true },
    cpf_assistido: { type: String, required: true },
    nome_assistido: { type: String },
    voluntario: { type: String, required: true },
    observacoes: { type: String },
    tipo: { type: String, required: true },
    prioridade: { type: Number },
    homeopatia_indicada: Boolean,
    gappus_indicado: Boolean,
    para_terceiro: Boolean,
    beneficiario: { type: require('./PessoaBeneficiada'), default: undefined },
    data_retorno: String,
    passe_pos_apometria: { type: Boolean },
    apometria_origem: { type: mongoose.Schema.Types.ObjectId, ref: 'Atendimento' },
    plano_acompanhamento: { type: String, enum: ['plano_1', 'plano_2', 'plano_3', 'plano_4'] }
}, { 
    collection: 'atendimentos'
});

module.exports = mongoose.model('Atendimento', AtendimentoSchema);
