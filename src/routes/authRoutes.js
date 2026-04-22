// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const agendamentoController = require('../controllers/agendamentoController'); 
const ativacoesSenhaController = require('../controllers/ativacoesSenhaController');
const authMiddleware = require('../middleware/authMiddleware');

// --- Autenticação Administrativa ---
router.post('/register', authController.cadastrarUsuarioAcesso);
router.post('/login', authController.login);

// =========================================================================
// ROTAS PÚBLICAS DE SERVIÇO (Acesso dos Médicos via Link)
// =========================================================================

router.get('/public/agendamentos/convite/:id', agendamentoController.getConviteDetails);
router.get('/public/agendamentos/disponibilidade', agendamentoController.getDisponibilidade);
router.post('/public/agendamentos/selecionar-data/:id', agendamentoController.receberSelecaoMedico);
router.post('/agendamentos/confirmar/:token', agendamentoController.confirmAgendamentoByToken);

// =========================================================================
// 🔑 NOVAS ROTAS EXCLUSIVAS PARA ATIVAÇÃO DE SENHA (INDEPENDENTES)
// =========================================================================

/** * 🔴 ROTAS ADMINISTRATIVAS (Protegidas) */
router.get('/ativacoes-senha', authMiddleware, ativacoesSenhaController.getAgendamentosAdmin); 
router.post('/ativacoes-senha/gerar-convite/:id', authMiddleware, ativacoesSenhaController.enviarCredenciaisAtivacao);

// Linha 44: Verifique se 'finalizarMeet' existe no Controller
router.put('/ativacoes-senha/finalizar/:id', authMiddleware, ativacoesSenhaController.finalizarMeet);

/** * 🟢 ROTAS PÚBLICAS (Médico) */
router.get('/public/ativacao-senha/medico/:token', ativacoesSenhaController.getMedicoDataByToken);
router.get('/public/ativacao-senha/disponibilidade', ativacoesSenhaController.getJanelasDisponiveis);
router.post('/public/ativacao-senha/agendar', ativacoesSenhaController.agendarAtivacaoSenha);

module.exports = router;