// src/routes/indexRoutes.js
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/DashboardController');
const assistidoController = require('../controllers/AssistidoController');
const voluntarioController = require('../controllers/VoluntarioController');
const solicitacaoController = require('../controllers/SolicitacaoController');

// --- ROTA PRINCIPAL (DASHBOARD) ---
router.get('/', dashboardController.getDashboard);

// --- ROTAS DE CADASTRO (VIEW) ---
// router.get('/cadastro', assistidoController.renderFormCadastro); // GET para ver o form
router.get('/fila-atendimento', solicitacaoController.getFilaHoje);
router.post('/assistido/novo', assistidoController.criarAssistido); 
router.get('/atendimento/iniciar/:id', solicitacaoController.iniciarAtendimento);


// --- ROTAS DE VOLUNTÁRIOS (Médiuns) --- // POST para salvar
router.get('/cadastro_mediuns', (req, res) => res.render('cadastro_mediuns'));
router.post('/voluntario/novo', voluntarioController.criarVoluntario);
router.get('/visualizar_voluntarios', voluntarioController.getVisualizarVoluntarios);

// --- ROTAS DE ATENDIMENTO ---
router.get('/solicitacao_atendimento', (req, res) => res.render('solicitacao_atendimento'));
router.post('/atendimento/solicitacao', solicitacaoController.criarSolicitacaoComCadastro);

// --- ROTA DE VISUALIZAÇÃO ---
router.get('/visualizar_voluntarios', (req, res) => res.render('visualizar_voluntarios'));

// --- ROTAS DE ATENDIMENTO (VIEWS) ---
router.get('/atendimento/apometrico', (req, res) => res.render('atendimento/apometrico', { atendimentos: [] }));
router.get('/atendimento/reiki', (req, res) => res.render('atendimento/reiki'));
router.get('/atendimento/auriculo', (req, res) => res.render('atendimento/auriculo'));
router.get('/atendimento/maos_sem_fronteiras', (req, res) => res.render('atendimento/maos_sem_fronteiras'));
router.get('/atendimento/homeopatico', (req, res) => res.render('atendimento/homeopatico'));
router.get('/atendimento/passe', (req, res) => res.render('atendimento/passe'));
router.get('/atendimento/historico/:cpf', solicitacaoController.buscarHistorico);

module.exports = router;