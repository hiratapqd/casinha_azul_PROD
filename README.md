# Casinha Azul PROD

Sistema web em Node.js + Express + EJS para apoiar a operacao da casa: cadastro de assistidos, recepcao, fila de atendimento, terapias, relatorios, voluntarios e livraria.

## Requisitos

- Node.js 18 ou superior
- MongoDB acessivel pela aplicacao
- Arquivo `.env` na raiz do projeto

## Variaveis de ambiente

Crie ou ajuste o arquivo `.env` com pelo menos:

```env
MONGODB_URI=sua-string-de-conexao
PORT=3000
```

## Instalacao

```bash
npm install
```

## Como iniciar o sistema

```bash
npm start
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
- `npm run db:seed-demo`: limpa os dados operacionais e gera uma base de demonstracao pronta para navegar pelo sistema.
- `npm run db:import-csv`: importa atendimentos a partir do arquivo `atendimentos.csv`.

## Gerando dados de demonstracao

Para deixar o sistema pronto para apresentacao ou testes manuais:

1. Configure o `.env` com `MONGODB_URI`.
2. Execute `npm install`.
3. Execute `npm run db:setup`.
4. Execute `npm run db:seed-demo`.
5. Execute `npm start`.

O seed de demonstracao cria:

- terapias ativas para o menu de atendimento
- configuracoes de fluxo para recepcao e geracao de passe
- limite de vagas da apometria
- assistidos de exemplo
- voluntarios de exemplo
- livros e vendas de exemplo
- historico de atendimentos
- solicitacoes na fila do dia

CPFs criados para demonstracao:

- `11111111111`
- `22222222222`
- `33333333333`
- `44444444444`

## Importando historico por CSV

Se voce quiser complementar a base com historico de atendimentos:

```bash
npm run db:import-csv
```

Por padrao o script usa o arquivo `atendimentos.csv` na raiz do projeto. Tambem suporta opcoes:

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

1. `Cadastro`: cadastrar assistidos quando ainda nao existem na base.
2. `Solicitacao de Atendimento > Atendimento Apometrico`: registrar pedidos de apometria.
3. `Solicitacao de Atendimento > Terapias Complementares`: fazer check-in de terapias do dia.
4. `Fila de Atendimento`: acompanhar quem esta confirmado, aguardando, em espera ou em atendimento.
5. `Atendimento`: abrir a ficha da terapia, informar CPF, terapeuta e concluir o atendimento.
6. `Assistidos`, `Voluntarios` e `Livraria`: consultar relatorios e operacao de apoio.

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
