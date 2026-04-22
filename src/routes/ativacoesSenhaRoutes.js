// src/routes/ativacoesSenhaRoutes.js

const express = require('express');
const router = express.Router();
const ativacoesController = require('../controllers/ativacoesSenhaController');
const authMiddleware = require('../middleware/authMiddleware'); 

// =========================================================================
// ROTAS PÚBLICAS (Acesso para o Médico via link do WhatsApp / Frontend Público)
// =========================================================================

/**
 * 1. Buscar horários disponíveis (Janelas de 15min entre 14h-16h)
 * @route GET /api/ativacoes/janelas?data=2026-03-05
 */
router.get('/janelas', ativacoesController.getJanelasDisponiveis);

/**
 * 2. Buscar dados do médico através do Token de convite
 * @route GET /api/ativacoes/medico/:token
 */
router.get('/medico/:token', ativacoesController.getMedicoDataByToken);

/**
 * 3. O médico confirma a escolha do horário e gera o link do Meet
 * @route POST /api/ativacoes/agendar
 */
router.post('/agendar', ativacoesController.agendarAtivacaoSenha);


// =========================================================================
// ROTAS PROTEGIDAS (Acesso apenas para Admin logado)
// =========================================================================

/**
 * 4. Listar todas as ativações para o Dashboard Admin (Filtro M'Boi automático no Controller)
 * @route GET /api/ativacoes
 */
router.get('/', authMiddleware, ativacoesController.getAgendamentosAdmin);

/**
 * 5. Gerar o convite inicial (Valida unidade M'Boi, cria Token e status CONVITE_ENVIADO)
 * @route POST /api/ativacoes/gerar-convite/:id
 */
router.post('/gerar-convite/:id', authMiddleware, ativacoesController.enviarCredenciaisAtivacao);

/**
 * 6. Finalizar o Meet (Status: CONCLUIDO, AUSENTE ou CANCELADO)
 * @route PUT /api/ativacoes/finalizar/:id
 */
router.put('/finalizar/:id', authMiddleware, ativacoesController.finalizarMeet);

module.exports = router;