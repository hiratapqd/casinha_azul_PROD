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

const formulariosAtendimento = {
    reiki: {
        titulo: 'Ficha de Atendimento - Reiki',
        tipo: 'reiki',
        action: '/atendimento/salvar',
        historicoTitulo: 'Histórico de Atendimentos - Reiki',
        mostrarObservacoes: false,
        observacoesLabel: 'Observações:',
        observacoesRows: 4,
        botaoTexto: 'Finalizar Atendimento',
        mensagemHistoricoInicial: 'Digite o CPF para carregar o histórico.',
        historicoVazioMensagem: 'Nenhum atendimento anterior.',
        sucessoMensagem: 'Atendimento de Reiki Finalizado!',
        redirectAposSalvar: '/fila-atendimento'
    },
    auriculo: {
        titulo: 'Ficha de Atendimento - Aurículo',
        tipo: 'auriculo',
        action: '/atendimento/salvar',
        historicoTitulo: 'Historico de Atendimentos - Aurículo',
        mostrarObservacoes: false,
        observacoesLabel: 'Evolução / Observações:',
        observacoesRows: 5,
        botaoTexto: 'Finalizar Atendimento',
        mensagemHistoricoInicial: 'Aguardando CPF...',
        historicoVazioMensagem: 'Nenhum historico encontrado.',
        sucessoMensagem: 'Atendimento de Aurículo finalizado!',
        redirectAposSalvar: '/fila-atendimento'
    },
    passe: {
        titulo: 'Ficha de Atendimento - Passe',
        tipo: 'passe',
        action: '/atendimento/salvar',
        historicoTitulo: 'Historico de Atendimentos - Passes',
        mostrarObservacoes: false,
        observacoesLabel: 'Evolução / Observações:',
        observacoesRows: 10,
        botaoTexto: 'Finalizar Passe',
        mensagemHistoricoInicial: 'Aguardando CPF...',
        historicoVazioMensagem: 'Nenhum histórico encontrado.',
        sucessoMensagem: 'Passe finalizado!',
        redirectAposSalvar: '/fila-atendimento'
    },
    homeopatico: {
        titulo: 'Ficha de Atendimento - Homeopático',
        tipo: 'homeopatia',
        action: '/atendimento/salvar',
        historicoTitulo: 'Historico de Atendimentos - Homeopatia',
        observacoesLabel: 'Evolução / Observações:',
        observacoesRows: 10,
        botaoTexto: 'Finalizar Atendimento',
        mensagemHistoricoInicial: 'Aguardando CPF...',
        historicoVazioMensagem: 'Nenhum histórico encontrado.',
        sucessoMensagem: 'Atendimento finalizado!',
        redirectAposSalvar: '/fila-atendimento',
        prefixoQueixa: 'RELATO NA TRIAGEM:\n',
        sufixoQueixa: '\n-----------------------------\nRECEITUÁRIO:\n'
    },
    maosSemFronteiras: {
        titulo: 'Ficha de Atendimento - Mãos Sem Fronteiras',
        tipo: 'maos_sem_fronteiras',
        action: '/atendimento/salvar',
        historicoTitulo: 'Histórico de Atendimentos - Mãos Sem Fronteiras',
        observacoesLabel: 'Evolução / Observações:',
        observacoesRows: 4,
        botaoTexto: 'Finalizar o Atendimento',
        mensagemHistoricoInicial: 'Digite o CPF para carregar o histórico.',
        historicoVazioMensagem: 'Nenhum histórico encontrado para este CPF.',
        sucessoMensagem: 'Atendimento salvo!',
        redirectAposSalvar: '/fila-atendimento',
        prefixoQueixa: 'RELATO NA TRIAGEM:\n',
        sufixoQueixa: '\n-----------------------------\nRECEITUÁRIO:\n'
    }
};

function renderFormularioAtendimento(chave) {
    return (req, res) => res.render('atendimento/formulario_padrao', formulariosAtendimento[chave]);
}

// --- ROTA PRINCIPAL (DASHBOARD) ---
router.get('/', dashboardController.getDashboard);

// API para carregar o historico no CPF (usada pelo script do formulario)
router.get('/api/historico/:tipo/:cpf', atendimentoController.getHistoricoPorTipo);
router.get('/api/dados-assistido/:cpf', atendimentoController.getDadosIniciais);

// --- ROTAS DE CADASTRO (VIEW) ---
router.get('/cadastro', assistidoController.renderFormCadastro);
router.get('/fila-atendimento', solicitacaoController.getFilaHoje);
router.post('/assistido/novo', assistidoController.criarAssistido);
router.get('/atendimento/iniciar/:id', solicitacaoController.iniciarAtendimento);

// --- ROTAS DE VOLUNTARIOS (Mediuns) --- // POST para salvar
router.get('/cadastro_mediuns', (req, res) => res.render('cadastro_mediuns'));
router.post('/medium/novo', voluntarioController.criarVoluntario);
router.get('/visualizar_voluntarios', voluntarioController.getVisualizarVoluntarios);
router.get('/relatorios/relatorio-voluntarios', relatorioController.getRelatorioVoluntarios);
router.get('/relatorios/relatorio-voluntarios-inativos', relatorioController.getVoluntariosInativos);

// --- ROTAS DE ATENDIMENTO ---
router.get('/solicitacao_atendimento', (req, res) => res.render('solicitacao_atendimento'));
router.post('/atendimento/solicitacao', solicitacaoController.criarSolicitacaoComCadastro);
router.post('/atendimento/salvar', atendimentoController.salvarAtendimento);

// --- ROTAS DE ATENDIMENTO (VIEWS) ---
router.get('/atendimento/apometrico', (req, res) => res.render('atendimento/apometrico'));
router.get('/atendimento/reiki', renderFormularioAtendimento('reiki'));
router.get('/atendimento/auriculo', renderFormularioAtendimento('auriculo'));
router.get('/atendimento/maos_sem_fronteiras', renderFormularioAtendimento('maosSemFronteiras'));
router.get('/atendimento/homeopatico', renderFormularioAtendimento('homeopatico'));
router.get('/atendimento/passe', renderFormularioAtendimento('passe'));
router.get('/atendimento/historico/:cpf', solicitacaoController.buscarHistorico);
router.get('/atendimento/cancelar/:id', solicitacaoController.cancelarSolicitacao);

// ROTAS DE RELATORIOS
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

// Pagina da Recepcao (passando as configs para gerar os checkboxes)
router.get('/recepcao', RecepcaoController.exibirPaginaRecepcao);
router.post('/api/recepcao/checkin', RecepcaoController.realizarCheckin);

module.exports = router;
