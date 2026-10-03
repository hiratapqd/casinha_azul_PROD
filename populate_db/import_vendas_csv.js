/* 
importar os dados do arquivo casinha_azul.vendas.csv.
as datas de venda de alguns livrossedrão alterados.
se existir apenas 1 venda, a data será D (data de hoje) -5
caso o livro tenha mais que uma venda siga esta logica
2 vendas a data seria D-35
3 vendas a data seria D-65
4 vendas a data seria D-95
5 vendas a data seria D-125
6 vendas a data seria D-155
7 vendas a data seria D-185

 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const Venda = require('../src/models/Venda');

const DEFAULT_CSV_PATH = path.resolve(__dirname, '..', 'casinha_azul.vendas.csv');
const DEFAULT_BATCH_SIZE = 500;
const UM_DIA_MS = 24 * 60 * 60 * 1000;

function parseArgs(argv) {
  const options = {
    csvPath: DEFAULT_CSV_PATH,
    batchSize: DEFAULT_BATCH_SIZE,
    dryRun: false,
    confirmDelete: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--confirm-delete') {
      options.confirmDelete = true;
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

function getDataVenda(baseDate, ordemVenda) {
  const diasRetroativos = 5 + ((ordemVenda - 1) * 30);
  return new Date(baseDate.getTime() - (diasRetroativos * UM_DIA_MS));
}

function parseNumber(value, fieldName, rowNumber) {
  const normalizedValue = String(value || '').trim().replace(',', '.');
  const number = Number(normalizedValue);

  if (!Number.isFinite(number)) {
    throw new Error(`Linha ${rowNumber}: ${fieldName} invalido.`);
  }

  return number;
}

function normalizeRows(headers, rows) {
  const requiredHeaders = [
    '_id',
    'livro_id',
    'titulo_livro',
    'quantidade',
    'valor_unitario',
    'valor_total',
    'data_venda',
  ];

  for (const header of requiredHeaders) {
    if (!headers.includes(header)) {
      throw new Error(`Cabecalho obrigatorio ausente: ${header}`);
    }
  }

  const documents = rows.map((values, index) => {
    const rowNumber = index + 2;
    const row = {};

    headers.forEach((header, headerIndex) => {
      row[header] = (values[headerIndex] ?? '').trim();
    });

    if (!row.livro_id) {
      throw new Error(`Linha ${rowNumber}: livro_id vazio.`);
    }

    if (!row.titulo_livro) {
      throw new Error(`Linha ${rowNumber}: titulo_livro vazio.`);
    }

    if (row._id && !mongoose.Types.ObjectId.isValid(row._id)) {
      throw new Error(`Linha ${rowNumber}: _id invalido.`);
    }

    return {
      rowNumber,
      rawId: row._id,
      livro_id: row.livro_id,
      titulo_livro: row.titulo_livro,
      quantidade: parseNumber(row.quantidade, 'quantidade', rowNumber),
      valor_unitario: parseNumber(row.valor_unitario, 'valor_unitario', rowNumber),
      valor_total: parseNumber(row.valor_total, 'valor_total', rowNumber),
      forma_pagamento: row.forma_pagamento || undefined,
    };
  });

  const duplicatedIds = documents
    .filter((document) => document.rawId)
    .map((document) => document.rawId)
    .filter((id, index, ids) => ids.indexOf(id) !== index);

  if (duplicatedIds.length) {
    throw new Error(`O CSV possui _id duplicado: ${[...new Set(duplicatedIds)].join(', ')}`);
  }

  return documents;
}

function aplicarDatasPorLivro(documents, baseDate) {
  const vendasPorLivro = new Map();

  documents.forEach((document) => {
    if (!vendasPorLivro.has(document.livro_id)) {
      vendasPorLivro.set(document.livro_id, []);
    }
    vendasPorLivro.get(document.livro_id).push(document);
  });

  for (const vendasLivro of vendasPorLivro.values()) {
    vendasLivro.forEach((document, index) => {
      document.data_venda = getDataVenda(baseDate, index + 1);
    });
  }

  return documents.map(({ rowNumber, rawId, ...document }) => {
    const venda = { ...document };

    if (rawId) {
      venda._id = rawId;
    }

    return venda;
  });
}

async function insertInBatches(documents, batchSize) {
  let inserted = 0;

  for (let index = 0; index < documents.length; index += batchSize) {
    const batch = documents.slice(index, index + batchSize);
    await Venda.insertMany(batch, { ordered: true });
    inserted += batch.length;
    console.log(`Lote inserido: ${inserted}/${documents.length}`);
  }
}

function gerarResumo(documents) {
  const resumo = new Map();

  documents.forEach((document) => {
    if (!resumo.has(document.livro_id)) {
      resumo.set(document.livro_id, {
        titulo: document.titulo_livro,
        quantidadeRegistros: 0,
        quantidadeVendida: 0,
        datas: [],
      });
    }

    const item = resumo.get(document.livro_id);
    item.quantidadeRegistros += 1;
    item.quantidadeVendida += document.quantidade;
    item.datas.push(require('../src/utils/operacao').dataISO(document.data_venda));
  });

  return resumo;
}

async function main() {
  const { csvPath, batchSize, dryRun, confirmDelete } = parseArgs(process.argv.slice(2));

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI nao encontrado no .env.');
  }

  if (!fs.existsSync(csvPath)) {
    throw new Error(`Arquivo CSV nao encontrado: ${csvPath}`);
  }

  const fileContent = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCsv(fileContent);

  if (rows.length < 2) {
    throw new Error('O CSV precisa ter cabecalho e ao menos uma linha de dados.');
  }

  const headers = rows[0].map((header) => header.trim());
  const normalizedRows = normalizeRows(headers, rows.slice(1));
  const documents = aplicarDatasPorLivro(normalizedRows, new Date());
  const resumo = gerarResumo(documents);

  console.log(`Arquivo lido com sucesso: ${documents.length} venda(s) encontradas.`);
  console.log(`Livros com venda no CSV: ${resumo.size}.`);
  console.log('Resumo das datas que serao importadas:');

  for (const [livroId, item] of resumo.entries()) {
    console.log(`- ${livroId} | ${item.titulo}: ${item.quantidadeRegistros} registro(s), ${item.quantidadeVendida} unidade(s), datas ${item.datas.join(', ')}`);
  }

  if (dryRun) {
    console.log('Dry-run ativo. Nenhum registro sera apagado ou inserido.');
    return;
  }

  if (!confirmDelete) {
    throw new Error('Para apagar a collection vendas e importar, rode novamente com --confirm-delete.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB conectado.');

  try {
    const deleteResult = await Venda.deleteMany({});
    console.log(`Collection vendas limpa: ${deleteResult.deletedCount} registro(s) apagado(s).`);

    await insertInBatches(documents, batchSize);
    console.log(`Importacao concluida: ${documents.length} venda(s) inserida(s) na collection vendas.`);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB desconectado.');
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Erro na importacao:', error.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  });
