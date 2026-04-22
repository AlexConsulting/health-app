// src/routes/apiRoutes.js

const express = require('express');
const router = express.Router();

// Middlewares
const authMiddleware = require('../middleware/authMiddleware');

// Controllers
const unidadeController = require('../controllers/unidadeController');
const dashboardController = require('../controllers/dashboardController'); 
const medicoController = require('../controllers/medicoController'); 
const agendamentoController = require('../controllers/agendamentoController'); 
const comunicadoController = require('../controllers/comunicadoController'); 
// 💡 IMPORTANTE: Adicionado o controller de Ativação de Senha
const ativacoesController = require('../controllers/ativacoesSenhaController'); 

// =========================================================================
// ROTAS PROTEGIDAS (EXIGE JWT - Uso Administrativo)
// =========================================================================

// 1. Rotas de Unidades
router.get('/unidades', authMiddleware, unidadeController.getUnidades);

// 2. Rotas do Dashboard
router.get('/dashboard/kpis', authMiddleware, dashboardController.getKpis);

// 3. Rotas de Médicos (CRUD)
router.post('/medicos', authMiddleware, medicoController.createMedico); 
router.get('/medicos', authMiddleware, medicoController.getMedicos); 
router.get('/medicos/:id', authMiddleware, medicoController.getMedicoById); 
router.put('/medicos/:id', authMiddleware, medicoController.updateMedico);
router.delete('/medicos/:id', authMiddleware, medicoController.deleteMedico); 
router.get('/medicos/sem-agendamento', authMiddleware, medicoController.getMedicosSemAgendamento); 

// 4. Rotas de Agendamento/Treinamento (Administrativo)
router.get('/agendamentos', authMiddleware, agendamentoController.getAgendamentos);
router.post('/agendamentos', authMiddleware, agendamentoController.createAgendamento); 
router.put('/agendamentos/confirmar-final/:id', authMiddleware, agendamentoController.confirmarAgendamentoFinal);
router.put('/agendamentos/:id/status', authMiddleware, agendamentoController.updateStatus);

// 5. 💡 NOVAS ROTAS: Ativação de Senha (Administrativo)
// Note que usamos os nomes de funções que definimos no export do controller
// 💡 AJUSTE: getAtivacoes -> getAgendamentosAdmin
router.get('/ativacoes-senha', authMiddleware, ativacoesController.getAgendamentosAdmin);
// 💡 AJUSTE: gerarConviteAtivacao -> enviarCredenciaisAtivacao
router.post('/ativacoes-senha/gerar-convite/:id', authMiddleware, ativacoesController.enviarCredenciaisAtivacao);
router.put('/ativacoes-senha/finalizar/:id', authMiddleware, ativacoesController.finalizarMeet);

// 6. Rotas de Comunicados 🎯
router.get('/empresas', authMiddleware, comunicadoController.getEmpresas);
router.get('/unidades-referencia', authMiddleware, comunicadoController.getUnidadesReferencia);
router.post('/comunicados', authMiddleware, comunicadoController.createComunicado);
router.get('/comunicados/status', authMiddleware, comunicadoController.getComunicadosStatus);
router.get('/comunicados/detalhes/:id', authMiddleware, comunicadoController.getComunicadoDetails);

// =========================================================================
// ROTAS PÚBLICAS (NÃO EXIGE JWT - Uso dos Médicos via link externo)
// =========================================================================

// --- FLUXO DE TREINAMENTOS ---
router.get('/public/agendamentos/detalhes/:id', agendamentoController.getConviteDetails);
router.get('/public/agendamentos/disponibilidade', agendamentoController.getDisponibilidade);
router.put('/public/agendamentos/selecionar-horario/:id', agendamentoController.receberSelecaoMedico);
router.get('/public/agendamentos/confirmar/:token', agendamentoController.confirmAgendamentoByToken);

// --- 💡 FLUXO DE ATIVAÇÃO DE SENHA (MÉDICO) ---
// Estas rotas são usadas pela tela "ativacao-senha.html" pública
router.get('/public/ativacao/janelas', ativacoesController.getJanelasDisponiveis);
router.get('/public/ativacao/medico/:token', ativacoesController.getMedicoDataByToken);
router.post('/public/ativacao/agendar', ativacoesController.agendarAtivacaoSenha);

// --- COMUNICADOS ---
router.get('/public/comunicado/ciente', comunicadoController.registerCiente);

module.exports = router;