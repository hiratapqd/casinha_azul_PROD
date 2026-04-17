const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const Atendimento = require('../src/models/Atendimento');

const DEFAULT_CSV_PATH = path.resolve(__dirname, '..', 'atendimentos.csv');
const DEFAULT_BATCH_SIZE = 500;

function parseArgs(argv) {
  const options = {
    csvPath: DEFAULT_CSV_PATH,
    batchSize: DEFAULT_BATCH_SIZE,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--file' || arg === '-f') {
      options.csvPath = path.resolve(process.cwd(), argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === '--batch-size' || arg === '-b') {
      options.batchSize = Number(argv[index + 1]);
      index += 1;
    }
  }

  if (!Number.isInteger(options.batchSize) || options.batchSize <= 0) {
    throw new Error('O valor de --batch-size deve ser um inteiro positivo.');
  }

  return options;
}

function parseCsv(content) {
  const rows = [];
  let currentField = '';
  let currentRow = [];
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i += 1;
      }

      currentRow.push(currentField);
      currentField = '';

      const isEmptyRow = currentRow.every((field) => field.trim() === '');
      if (!isEmptyRow) {
        rows.push(currentRow);
      }
      currentRow = [];
      continue;
    }

    currentField += char;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    const isEmptyRow = currentRow.every((field) => field.trim() === '');
    if (!isEmptyRow) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function normalizeRow(headers, values, rowNumber) {
  const row = {};

  headers.forEach((header, index) => {
    row[header] = (values[index] ?? '').trim();
  });

  if (!row.cpf_assistido) {
    throw new Error(`Linha ${rowNumber}: cpf_assistido vazio.`);
  }

  if (!row.voluntario) {
    throw new Error(`Linha ${rowNumber}: voluntario vazio.`);
  }

  if (!row.tipo) {
    throw new Error(`Linha ${rowNumber}: tipo vazio.`);
  }

  return {
    data: new Date(),
    cpf_assistido: row.cpf_assistido,
    nome_assistido: row.nome_assistido || undefined,
    voluntario: row.voluntario,
    observacoes: row.observacoes || undefined,
    tipo: row.tipo,
  };
}

async function insertInBatches(documents, batchSize) {
  let inserted = 0;

  for (let index = 0; index < documents.length; index += batchSize) {
    const batch = documents.slice(index, index + batchSize);
    await Atendimento.insertMany(batch, { ordered: true });
    inserted += batch.length;
    console.log(`Lote inserido: ${inserted}/${documents.length}`);
  }
}

async function main() {
  const { csvPath, batchSize, dryRun } = parseArgs(process.argv.slice(2));

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI não encontrado no .env.');
  }

  if (!fs.existsSync(csvPath)) {
    throw new Error(`Arquivo CSV não encontrado: ${csvPath}`);
  }

  const fileContent = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCsv(fileContent);

  if (rows.length < 2) {
    throw new Error('O CSV precisa ter cabeçalho e ao menos uma linha de dados.');
  }

  const headers = rows[0].map((header) => header.trim());
  const requiredHeaders = ['cpf_assistido', 'nome_assistido', 'voluntario', 'observacoes', 'tipo'];

  for (const header of requiredHeaders) {
    if (!headers.includes(header)) {
      throw new Error(`Cabeçalho obrigatório ausente: ${header}`);
    }
  }

  const documents = rows
    .slice(1)
    .map((values, index) => normalizeRow(headers, values, index + 2));

  console.log(`Arquivo lido com sucesso: ${documents.length} atendimento(s) encontrados.`);

  if (dryRun) {
    console.log('Dry-run ativo. Nenhum documento foi inserido.');
    console.log('Primeiro documento:', JSON.stringify(documents[0], null, 2));
    return;
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB conectado.');

  try {
    await insertInBatches(documents, batchSize);
    console.log(`Importação concluída: ${documents.length} documento(s) inserido(s) na collection atendimentos.`);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB desconectado.');
  }
}

main().catch(async (error) => {
  console.error('Erro na importação:', error.message);
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  process.exit(1);
});
