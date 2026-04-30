const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const Atendimento = require('../src/models/Atendimento');

const SAMPLE_COUNSELING = [
    { cpf: '12345678901', nome: 'assistido exemplo1' },
    { cpf: '12345678902', nome: 'assistido exemplo2' },
    { cpf: '12345678903', nome: 'assistido exemplo3' }
];

const EVENTOS_DEMO = [
    {
        tipo: 'apometria',
        diasAtras: 28,
        voluntario: 'Jane Doe',
        observacoes: 'Cenário demonstração: apometria realizada há 28 dias.'
    },
    {
        tipo: 'passe',
        diasAtras: 28,
        voluntario: 'Jack Doe',
        observacoes: 'Cenário demonstração: passe realizado após apometria há 28 dias.'
    },
    {
        tipo: 'reiki',
        diasAtras: 21,
        voluntario: 'John Doe',
        observacoes: 'Cenário demonstração: sessão de reiki há 21 dias.'
    },
    {
        tipo: 'passe',
        diasAtras: 21,
        voluntario: 'John Doe',
        observacoes: 'Cenário demonstração: passe realizado após reiki há 21 dias.'
    },
    {
        tipo: 'reiki',
        diasAtras: 14,
        voluntario: 'John Doe',
        observacoes: 'Cenário demonstração: sessão de reiki há 14 dias.'
    },
    {
        tipo: 'passe',
        diasAtras: 14,
        voluntario: 'John Doe',
        observacoes: 'Cenário demonstração: passe realizado após reiki há 14 dias.'
    },
    {
        tipo: 'reiki',
        diasAtras: 7,
        voluntario: 'John Doe',
        observacoes: 'Cenário demonstração: sessão de reiki há 7 dias.'
    },
    {
        tipo: 'passe',
        diasAtras: 7,
        voluntario: 'John Doe',
        observacoes: 'Cenário demonstração: passe realizado após reiki há 7 dias.'
    }
];

function dataDiasAtras(dias) {
    const data = new Date();
    data.setHours(12, 0, 0, 0);
    data.setDate(data.getDate() - dias);
    return data;
}

function montarAtendimentosDemo() {
    return SAMPLE_COUNSELING.flatMap(({ cpf, nome }) =>
        EVENTOS_DEMO.map((evento) => ({
            cpf_assistido: cpf,
            nome_assistido: nome,
            tipo: evento.tipo,
            data: dataDiasAtras(evento.diasAtras),
            voluntario: evento.voluntario,
            observacoes: evento.observacoes
        }))
    );
}

async function main() {
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI nao encontrado no .env.');
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const atendimentos = montarAtendimentosDemo();

    await Atendimento.insertMany(atendimentos);

    console.log(`Cenário demonstração inserido com sucesso: ${atendimentos.length} atendimentos.`);
    atendimentos.forEach((item) => {
        console.log(
            `${item.cpf_assistido} | ${item.tipo} | ${item.data.toLocaleDateString('pt-BR')} | ${item.nome_assistido}`
        );
    });
}

main()
    .catch((err) => {
        console.error('Erro ao inserir Cenário demonstração:', err.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
    });
