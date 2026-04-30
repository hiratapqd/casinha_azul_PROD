const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const Atendimento = require('../src/models/Atendimento');
const Assistido = require('../src/models/Assistido');

const DEMO_ASSISTIDOS = [
    { cpf: '12345678906', nome: 'assistido exemplo 6' },
    { cpf: '12345678907', nome: 'assistido exemplo 7' },
    { cpf: '12345678908', nome: 'assistido exemplo 8' },
    { cpf: '12345678909', nome: 'assistido exemplo 9' }
];

function dataDiasAtras(dias) {
    const data = new Date();
    data.setHours(12, 0, 0, 0);
    data.setDate(data.getDate() - dias);
    return data;
}

function montarAtendimentosDemo() {
    return [
        {
            cpf_assistido: '12345678906',
            nome_assistido: 'assistido exemplo6',
            tipo: 'apometria',
            data: dataDiasAtras(91),
            voluntario: 'Jane Doe',
            observacoes: 'Cenario demo: apometria realizada há 91 dias.'
        },
        {
            cpf_assistido: '12345678906',
            nome_assistido: 'assistido exemplo6',
            tipo: 'passe',
            data: dataDiasAtras(91),
            voluntario: 'Jack Doe',
            observacoes: 'Cenario demo: passe realizado após apometria há 91 dias.'
        },
        {
            cpf_assistido: '12345678907',
            nome_assistido: 'assistido exemplo7',
            tipo: 'apometria',
            data: dataDiasAtras(61),
            voluntario: 'Jane Doe',
            observacoes: 'Cenario demo: apometria realizada há 61 dias.'
        },
        {
            cpf_assistido: '12345678907',
            nome_assistido: 'assistido exemplo7',
            tipo: 'passe',
            data: dataDiasAtras(61),
            voluntario: 'Jack Doe',
            observacoes: 'Cenario demo: passe realizado após apometria há 61 dias.'
        },
        {
            cpf_assistido: '12345678908',
            nome_assistido: 'assistido exemplo8',
            tipo: 'apometria',
            data: dataDiasAtras(31),
            voluntario: 'Jane Doe',
            observacoes: 'Cenario demo: apometria realizada há 31 dias.'
        },
        {
            cpf_assistido: '12345678908',
            nome_assistido: 'assistido exemplo8',
            tipo: 'passe',
            data: dataDiasAtras(31),
            voluntario: 'Jack Doe',
            observacoes: 'Cenario demo: passe realizado após apometria há 31 dias.'
        },
        {
            cpf_assistido: '12345678909',
            nome_assistido: 'assistido exemplo9',
            tipo: 'apometria',
            data: dataDiasAtras(21),
            voluntario: 'Jane Doe',
            observacoes: 'Cenario demo: apometria realizada há 21 dias.'
        },
        {
            cpf_assistido: '12345678909',
            nome_assistido: 'assistido exemplo9',
            tipo: 'passe',
            data: dataDiasAtras(21),
            voluntario: 'Jack Doe',
            observacoes: 'Cenario demo: passe realizado após apometria há 21 dias.'
        },
        {
            cpf_assistido: '12345678909',
            nome_assistido: 'assistido exemplo9',
            tipo: 'reiki',
            data: dataDiasAtras(14),
            voluntario: 'John Doe',
            observacoes: 'Cenario demo: sessão de reiki há 14 dias.'
        },
        {
            cpf_assistido: '12345678909',
            nome_assistido: 'assistido exemplo9',
            tipo: 'passe',
            data: dataDiasAtras(14),
            voluntario: 'John Doe',
            observacoes: 'Cenario demo: passe realizado após reiki há 14 dias.'
        },
        {
            cpf_assistido: '12345678909',
            nome_assistido: 'assistido exemplo9',
            tipo: 'reiki',
            data: dataDiasAtras(7),
            voluntario: 'John Doe',
            observacoes: 'Cenario demo: sessão de reiki há 7 dias.'
        },
        {
            cpf_assistido: '12345678909',
            nome_assistido: 'assistido exemplo9',
            tipo: 'passe',
            data: dataDiasAtras(7),
            voluntario: 'John Doe',
            observacoes: 'Cenario demo: passe realizado após reiki há 7 dias.'
        },
        {
            cpf_assistido: '12345678909',
            nome_assistido: 'assistido exemplo9',
            tipo: 'reiki',
            data: dataDiasAtras(2),
            voluntario: 'John Doe',
            observacoes: 'Cenario demo: sessão de reiki há 2 dias.'
        },
        {
            cpf_assistido: '12345678909',
            nome_assistido: 'assistido exemplo9',
            tipo: 'passe',
            data: dataDiasAtras(2),
            voluntario: 'John Doe',
            observacoes: 'Cenario demo: passe realizado após reiki há 2 dias.'
        }
    ];
}

async function main() {
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI nao encontrado no .env.');
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const cpfs = DEMO_ASSISTIDOS.map((item) => item.cpf);
    const atendimentos = montarAtendimentosDemo();

    await Assistido.bulkWrite(
        DEMO_ASSISTIDOS.map((assistido) => ({
            updateOne: {
                filter: { _id: assistido.cpf },
                update: {
                    $set: {
                        nome_assistido: assistido.nome,
                        status: 'Ativo'
                    }
                },
                upsert: true
            }
        }))
    );

    await Atendimento.deleteMany({
        cpf_assistido: { $in: cpfs },
        tipo: { $in: ['apometria', 'passe', 'reiki'] }
    });

    await Atendimento.insertMany(atendimentos);

    console.log(`Cenario demo inserido com sucesso: ${atendimentos.length} atendimentos.`);
    atendimentos.forEach((item) => {
        console.log(
            `${item.cpf_assistido} | ${item.tipo} | ${item.data.toLocaleDateString('pt-BR')} | ${item.nome_assistido}`
        );
    });
}

main()
    .catch((err) => {
        console.error('Erro ao inserir cenario demo:', err.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
    });
