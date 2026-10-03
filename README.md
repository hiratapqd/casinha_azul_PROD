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

## Gestão de assistidos, acompanhamento e operação

- **Assistidos > Consulta e Edição de Assistidos** (`/assistidos`): pesquisa por nome ou CPF, com filtro por situação e paginação. Abra a ficha para editar dados e consultar o histórico de todas as modalidades. O CPF permanece fixo; inativar preserva o histórico.
- **Atendimento > Apometria**: selecione o plano de acompanhamento antes de finalizar. O Plano 1 é a seleção padrão. A gravação da apometria registra automaticamente um acompanhamento único com metas por modalidade:

  | Plano | Sessões previstas |
  |---|---|
  | Plano 1 (padrão) | 3 passes + 3 Reikis |
  | Plano 2 | 3 passes + 3 Reikis + 3 aurículos |
  | Plano 3 | 3 passes + 3 aurículos |
  | Plano 4 | 3 passes |

  O progresso considera somente atendimentos desde o instante dessa apometria, excluindo o passe de encaminhamento após ela. Esse passe permanece no histórico, identificado por `passe_pos_apometria` nos novos registros. Para registros antigos sem identificação, a contagem considera o primeiro passe no mesmo dia GMT-3, após cada apometria, como encaminhamento; uma identificação explícita prevalece sobre essa inferência. Cada modalidade é contada separadamente; sessões extras em uma modalidade não substituem as de outra. A conclusão permanece manual na edição do acompanhamento. Uma nova apometria encerra como interrompidos os acompanhamentos ativos anteriores que se sobrepõem ao novo ciclo e preserva seu histórico. As metas e o início do plano selecionado são preservados ao editar sua situação, retorno, responsável e orientações.
- Na apometria, marque **Indicar Homeopatia** e/ou **Encaminhar ao GAPPUS** para adicionar esses acompanhamentos ao plano do assistido. As indicações são salvas junto do atendimento e do plano, sem alterar as quantidades de passe, Reiki e aurículo. As duas modalidades precisam estar ativas nas configurações para receber novas indicações.
- **Atendimento > Homeopatia**: informe a data do próximo retorno, posterior ao dia atual. Ela é gravada junto do atendimento e aparece na ficha e nos acompanhamentos do ciclo correspondente; o filtro de retornos vencidos também considera essa data. O atendimento mais recente do ciclo define o próximo retorno e preserva as datas anteriores no histórico.
- **Atendimento > GAPPUS** (`/atendimento/gappus`): lista de presença por encontro, com uma lista por data GMT-3. Abra a data, selecione o voluntário responsável e marque os presentes. Assistidos com plano ativo encaminhado ao grupo aparecem automaticamente; outros assistidos cadastrados podem ser adicionados pelo CPF. A lista pode ser reaberta para corrigir presenças e não cria atendimentos individuais na fila nem altera metas de sessões. Os registros aparecem na ficha do assistido, no acompanhamento do ciclo e na contagem diária de presenças do painel. Uma presença após a apometria também elimina a interrupção inferida por falta de retorno. Não é permitido registrar presenças futuras. Alterações simultâneas na mesma lista são bloqueadas por versão.
- **Novo plano de acompanhamento**, na ficha: registre uma modalidade de atendimento individual, sessões previstas, data de início, previsão de retorno, responsável e orientações. Há um plano por modalidade e apenas um plano ativo de cada modalidade por assistido. As sessões realizadas são calculadas a partir dos atendimentos registrados desde o início; ao concluir ou interromper, a contagem fica limitada à data de encerramento. O GAPPUS é acompanhado pelas listas de presença.
- **Assistidos > Acompanhamentos e Retornos** (`/acompanhamentos`): consulte planos por situação e filtre retornos vencidos. Nas situações `Interrompido` e `Todas`, também aparecem assistidos sem plano cadastrado que receberam passe após a última apometria e não tiveram atendimento em outra modalidade desde então. Essa classificação é calculada pelo histórico, sem prazo mínimo de ausência, e deixa de aparecer quando há retorno em outra modalidade. Um retorno previsto vence no dia seguinte à previsão. Essa previsão não cria uma solicitação nem reserva vaga na fila.
- Na apometria em intenção de outra pessoa, marque essa opção e informe o nome do assistido beneficiado, com CPF opcional. Use a busca para reutilizar uma pessoa já registrada. Quem compareceu é o atendido e permanece como titular das sessões; o Plano 4, somente passes, é selecionado automaticamente. Quando houver encaminhamento ao GAPPUS, atendido e assistido entram separadamente no grupo.
- **Configurações > Planos de tratamento** (`/configuracoes#planos-tratamento`): edite o nome e as quantidades dos quatro modelos. O Plano 4 aceita somente passes. Zero remove uma modalidade; deve haver pelo menos uma sessão. O Plano 1 é o padrão para atendimento próprio e o Plano 4 para atendimento em intenção de outra pessoa. Alterações valem para novas associações na apometria e preservam as metas dos planos já atribuídos.
- **Configurações** (`/configuracoes`): ativa ou desativa as modalidades, incluindo o grupo GAPPUS. Para as seis modalidades de atendimento individual, define vagas principais e de espera, ambas com padrão e substituições por dia da semana, exigência de solicitação prévia e encaminhamento para passe. Campo diário vazio usa o padrão; zero nas vagas principais fecha o dia, e zero nas vagas de espera desativa apenas a espera. Vagas principais padrão em branco permanecem ilimitadas. A inativação impede novas solicitações, mas permite finalizar solicitações já existentes. O GAPPUS não usa vagas individuais; quando inativo, suas listas existentes continuam disponíveis para consulta e correção.
- Os intervalos de apometria ficam editáveis nas configurações. Sem configuração salva, os valores anteriores do código (27 e 90 dias) são preservados. O intervalo especial mantém a condição histórica atual: uma apometria, um passe e nenhuma outra modalidade.
- **Voluntários > Escala por Data e Substituições** (`/voluntarios/escala-data`): consulte a disponibilidade semanal como referência e registre modalidade, voluntário e horário para uma data. Para substituir, selecione outro voluntário e informe o motivo. Registre `Ausente` quando não houver substituto. Horários sobrepostos do mesmo voluntário efetivo são bloqueados, inclusive entre modalidades diferentes.
- O painel usa a escala por data quando existe algum registro naquele dia; sem registros, mostra a disponibilidade semanal como referência. Registrar uma escala não registra presença automaticamente.

As coleções `planos_acompanhamento` e `escalas_datas` são criadas pelo Mongoose no primeiro uso; também constam no script de preparação. As alterações dos quatro modelos são armazenadas em `modelos_planos_tratamento`, criada automaticamente no primeiro uso. Os modelos definem índices para evitar planos ativos duplicados e reservas simultâneas de horários. A validação de novas escalas exige voluntários ativos com disponibilidade cadastrada na modalidade; permite um dia diferente do padrão semanal para cobrir substituições.

As listas do GAPPUS ficam na coleção `encontros_gappus`, criada automaticamente, com data como identificador e uma versão para proteger correções simultâneas. O responsável deve ser um voluntário ativo com disponibilidade cadastrada em GAPPUS; listas existentes preservam o responsável original para permitir correção histórica. Cadastre essa disponibilidade em **Voluntários > Cadastro de Voluntários** antes do primeiro encontro.

No GAPPUS, a busca por nome ou CPF permite incluir pessoas existentes; familiares também podem ser cadastrados manualmente com nome obrigatório e CPF opcional. Cada pessoa recebe um identificador próprio. **Ver presenças** mostra sua contagem e todos os encontros em que esteve presente, inclusive sem CPF. **Registrar desistência** remove a pessoa das próximas listas automáticas, preservando as presenças já salvas. **Retomar** permite voltar ao grupo. Cadastros manuais e desistências ficam na coleção `participantes_gappus`; esses registros não encerram o plano de sessões do atendido.

A apometria, seu plano e as alterações na fila usam uma transação quando o MongoDB oferece esse recurso. Em MongoDB standalone, o sistema reserva a solicitação durante a finalização e, em caso de erro, tenta desfazer os registros da tentativa e restaurar os planos anteriores. Se a recuperação falhar ou o processo parar durante a gravação, a solicitação pode permanecer em `Finalizando` e deve ser conferida antes de uma nova tentativa. Essa recuperação não substitui a atomicidade das transações de um replica set.

### Datas e horários

A operação utiliza GMT-3 fixo (`UTC-03:00`, `Etc/GMT+3` no Intl), independentemente do fuso do servidor ou do navegador. O código compartilhado em `public/dataHora.js` normaliza a exibição, os limites diários e mensais, os filtros de inatividade e os campos de data. O dia começa em `03:00:00.000Z` e termina em `02:59:59.999Z` do dia UTC seguinte.

Datas de eventos são gravadas como instantes reais em campos Date do MongoDB (UTC internamente), sem subtrair horas antes de salvar. Nascimento é uma data civil: os novos cadastros usam meia-noite GMT-3 e a leitura preserva o dia dos registros legados gravados à meia-noite UTC. Horários da escala são valores `HH:mm` da operação em GMT-3.

A normalização não reescreve o histórico. Registros antigos que tenham sido gravados com deslocamento manual de três horas precisam de uma auditoria de dados antes de qualquer correção no banco.

### Verificação local

```bash
npm test
```

Os testes usam dados simulados, cobrem as regras de acompanhamento, configurações, substituições, validações e renderização de formulários e não acessam o banco de produção.

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

O guia operacional voltado ao usuario final esta em [MANUAL_DO_USUARIO.docx](./MANUAL_DO_USUARIO.docx).
