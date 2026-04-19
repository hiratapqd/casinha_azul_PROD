# Casinha Azul PROD

Sistema web em Node.js + Express + EJS para apoiar a operacao da casa: cadastro de assistidos, recepcao, fila de atendimento, terapias, relatorios, voluntarios e livraria.

## Requisitos

- Node.js 18 ou superior
- MongoDB acessivel pela aplicação
- Arquivo `.env` na raiz do projeto

## Variaveis de ambiente

Crie ou ajuste o arquivo `.env` com pelo menos:

```env
MONGODB_URI=sua-string-de-conexao
PORT=3000
```

## Instalação

```bash
npm install
```

## Como iniciar o sistema

```bash
npm server.ja
```

Depois abra no navegador:

```text
http://localhost:3000
```

## Comandos uteis

```bash
npm run db:setup
npm run db:seed-demo
npm run db:import-csv
```

O que cada comando faz:

- `npm run db:setup`: cria as collections principais no banco.
- `npm run db:seed_demo_apometria`: limpa os dados dos Assistidos Exemplo 6, Assistidos Exemplo 7, Assistidos Exemplo 8 e Assistidos Exemplo 9 e gera os dados para demonstrar o bloqueio de solicitação de atendimento apometrico.
- `npm run db:import-csv`: importa atendimentos a partir do arquivo `atendimentos.csv`.

## Gerando dados de demonstracao

Para deixar o sistema pronto para apresentacao ou testes manuais:

1. Configure o `.env` com `MONGODB_URI`.
2. Execute `npm install`.
3. Execute `npm run db:setup`.
4. Execute `npm run db:seed-demo`.
5. Execute `npm server.js`.

O seed de demonstração prepara os dados para demonstrar o bloqueio de solicitação de atendimento apometrico dentro dos seguintes parametros: a proxima apometria somente depois de 28 dias, caso o assistido tenha recebido o atendimento apometrico e passe e não fez nenhum outro tratamento, será necessário esperar 90 dias para uma nova solicitação de apometria

CPFs ustilizados para demonstracao:

- `12345678906` – realizou apometria há 31dias e não voltou para os tratamentos indicados
- `12345678907` – realizou apometria há 61dias e não voltou para os tratamentos indicados
- `12345678908` – realizou apometria há 91dias e não voltou para os tratamentos indicados
- `12345678909` – realizou apometria e passe, 3 reikis mas ainda não completou 28 dias para solicitar uma nova apometria

## Importando historico por CSV

Se voce quiser complementar a base com historico de atendimentos:

```bash
npm run db:import-csv
```

Por padrao o script usa o arquivo `atendimentos.csv` na raiz do projeto. Tambem suporta opções:

```bash
node populate_db/import_atendimentos_csv.js --file .\atendimentos.csv --batch-size 200
node populate_db/import_atendimentos_csv.js --dry-run
```

Cabecalho esperado no CSV:

```csv
cpf_assistido,nome_assistido,voluntario,observacoes,tipo
```

## Como usar o sistema

Fluxo recomendado para uso basico:

1. `Cadastro`: cadastrar assistidos quando ainda não existem na base.
2. `Solicitacao de Atendimento > Atendimento Apometrico`: registrar pedidos de apometria, caso um assistido novo, já cadastra no banco de dados.
3. `Solicitacao de Atendimento > Terapias Complementares`: fazer check-in de terapias do dia.
4. `Fila de Atendimento`: acompanhar quem esta confirmado, aguardando, em espera ou em atendimento.
5. `Atendimento`: abrir a ficha da terapia, informar CPF, terapeuta e concluir o atendimento.
6. `Assistidos`, `Voluntarios` e `Livraria`: consultar relatorios e operação de apoio.

## Estrutura principal

```text
server.js
src/
  controllers/
  models/
  routes/
views/
public/
populate_db/
```

## Manual do usuario

O guia operacional voltado ao usuario final esta em [MANUAL_DO_USUARIO.md](./MANUAL_DO_USUARIO.md).
