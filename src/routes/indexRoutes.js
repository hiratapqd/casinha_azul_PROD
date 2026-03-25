// src/routes/indexRoutes.js
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/DashboardController');
const assistidoController = require('../controllers/AssistidoController');
const voluntarioController = require('../controllers/VoluntarioController');
const solicitacaoController = require('../controllers/SolicitacaoController');
const atendimentoController = require('../controllers/AtendimentoController');
const relatorioController = require('../controllers/RelatorioController');
const livrariaController = require('../controllers/LivrariaController');
const RecepcaoController = require('../controllers/RecepcaoController');
const ConfiguracaoFluxo = require('../models/ConfiguracaoFluxo');
const Atendimento = require('../models/Atendimento');

// --- ROTA PRINCIPAL (DASHBOARD) ---
router.get('/', dashboardController.getDashboard);

// API para carregar o histórico no CPF (usada pelo script do formulário)
//router.get('/api/historico/:tipo/:cpf', atendimentoController.getHistoricoPorCPF);
router.get('/api/historico/:tipo/:cpf', atendimentoController.getHistoricoPorTipo); 
router.get('/api/dados-assistido/:cpf', atendimentoController.getDadosIniciais);
//router.get('/api/dados-assistido/:cpf', atendimentoController.getDadosIniciais);

// --- ROTAS DE CADASTRO (VIEW) ---
router.get('/cadastro', assistidoController.renderFormCadastro);
router.get('/fila-atendimento', solicitacaoController.getFilaHoje);
router.post('/assistido/novo', assistidoController.criarAssistido); 
router.get('/atendimento/iniciar/:id', solicitacaoController.iniciarAtendimento);
router.post('/atendimento/reiki', atendimentoController.salvarAtendimento);


// --- ROTAS DE VOLUNTÁRIOS (Médiuns) --- // POST para salvar
router.get('/cadastro_mediuns', (req, res) => res.render('cadastro_mediuns'));
router.post('/medium/novo', voluntarioController.criarVoluntario);
router.get('/visualizar_voluntarios', voluntarioController.getVisualizarVoluntarios);
router.get('/relatorios/relatorio-voluntarios', relatorioController.getRelatorioVoluntarios);

// --- ROTAS DE ATENDIMENTO ---
router.get('/solicitacao_atendimento', (req, res) => res.render('solicitacao_atendimento'));
router.post('/atendimento/solicitacao', solicitacaoController.criarSolicitacaoComCadastro);
router.post('/atendimento/salvar', atendimentoController.salvarAtendimento);

// --- ROTA DE VISUALIZAÇÃO ---
router.get('/visualizar_voluntarios', (req, res) => res.render('visualizar_voluntarios'));

// --- ROTAS DE ATENDIMENTO (VIEWS) ---
router.get('/atendimento/apometrico', (req, res) => res.render('atendimento/apometrico'));
router.get('/atendimento/reiki', (req, res) => res.render('atendimento/reiki'));
router.get('/atendimento/auriculo', (req, res) => res.render('atendimento/auriculo'));
router.get('/atendimento/maos_sem_fronteiras', (req, res) => res.render('atendimento/maos_sem_fronteiras'));
router.get('/atendimento/homeopatico', (req, res) => res.render('atendimento/homeopatico'));
router.get('/atendimento/passe', (req, res) => res.render('atendimento/passe'));
router.get('/atendimento/historico/:cpf', solicitacaoController.buscarHistorico);
router.get('/atendimento/cancelar/:id', solicitacaoController.cancelarSolicitacao);

// ROTAS DE RELATÓRIOS
router.get('/relatorios/atendimentos-hoje', relatorioController.getAtendimentosHoje);
router.get('/relatorios/todos-assistidos', relatorioController.getRelatorioGeralAssistidos);
router.get('/relatorios/apometria-inativos', relatorioController.getApometriaInativos);

// --- ROTAS DA LIVRARIA ---
router.get('/livraria/cadastro', livrariaController.getCadastroLivro);
router.post('/livraria/salvar', livrariaController.salvarLivro);
router.get('/livraria/estoque', livrariaController.getEstoque);
router.post('/livraria/venda', livrariaController.registrarVenda);
router.get('/livraria/editar/:id', livrariaController.getEditarLivro);
router.post('/livraria/atualizar/:id', livrariaController.atualizarLivro);
router.post('/livraria/venda-rapida', livrariaController.registrarVendaRapida);

// Página da Recepção (passando as configs para gerar os checkboxes)
router.get('/recepcao', RecepcaoController.exibirPaginaRecepcao); 
router.post('/api/recepcao/checkin', RecepcaoController.realizarCheckin);

module.exports = router;