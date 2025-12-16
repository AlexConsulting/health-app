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

// =========================================================================
// ROTAS PROTEGIDAS (EXIGE JWT)
// =========================================================================

// 1. Rotas de Unidades
router.get('/unidades', authMiddleware, unidadeController.getUnidades);

// 2. Rotas do Dashboard
router.get('/dashboard/kpis', authMiddleware, dashboardController.getKpis);

// 3. Rotas de Médico (CRUD)
router.post('/medicos', authMiddleware, medicoController.createMedico); 
router.get('/medicos', authMiddleware, medicoController.getMedicos); 

// Rota para buscar médico por ID (necessário para o modo de EDIÇÃO)
router.get('/medicos/:id', authMiddleware, medicoController.getMedicoById); 

router.put('/medicos/:id', authMiddleware, medicoController.updateMedico);
router.delete('/medicos/:id', authMiddleware, medicoController.deleteMedico); 

// Rota para listar médicos sem agendamento
router.get('/medicos/sem-agendamento', authMiddleware, medicoController.getMedicosSemAgendamento); 

// 4. Rotas de Agendamento/Treinamento
// GET /api/agendamentos: Listar treinamentos com filtros
router.get('/agendamentos', authMiddleware, agendamentoController.getAgendamentos);

// POST /api/agendamentos: Criar um novo agendamento (PENDENTE ou AGENDADO)
router.post('/agendamentos', authMiddleware, agendamentoController.createAgendamento); 

// ❌ REMOVIDA/SUBSTITUÍDA: A lógica de 'agendar-individual' é agora tratada por updateStatus.
// router.post('/agendamentos/agendar-individual', authMiddleware, agendamentoController.agendarIndividual); 

// ✅ NOVO ADMIN: Rota para o Admin confirmar a data PRE_AGENDADA -> AGENDADO
router.put('/agendamentos/confirmar-final/:id', authMiddleware, agendamentoController.confirmarAgendamentoFinal);

// PUT /api/agendamentos/:id/status: Atualizar o status de um agendamento específico
router.put('/agendamentos/:id/status', authMiddleware, agendamentoController.updateStatus);


// =========================================================================
// ROTA PÚBLICA (NÃO EXIGE JWT) - Deverá ser configurada em um roteador SEM o authMiddleware
// =========================================================================

module.exports = router;