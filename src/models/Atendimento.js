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
    plano_atendimento: { type: new mongoose.Schema({
        modelo: { type: String, required: true }, nome: { type: String, required: true },
        metas: [{ _id: false, terapia: { type: String, enum: ['apometria', 'passe', 'reiki', 'auriculo'], required: true },
            sessoes_previstas: { type: Number, min: 1, max: 100, required: true } }]
    }, { _id: false }), default: undefined },
    passe_pos_apometria: { type: Boolean },
    apometria_origem: { type: mongoose.Schema.Types.ObjectId, ref: 'Atendimento' }
}, { 
    collection: 'atendimentos'
});

module.exports = mongoose.model('Atendimento', AtendimentoSchema);
