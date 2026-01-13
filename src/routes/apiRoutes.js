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
// 🎯 NOVO: Importação do Controller de Comunicados
const comunicadoController = require('../controllers/comunicadoController'); 

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
router.get('/agendamentos', authMiddleware, agendamentoController.getAgendamentos);
router.post('/agendamentos', authMiddleware, agendamentoController.createAgendamento); 
router.put('/agendamentos/confirmar-final/:id', authMiddleware, agendamentoController.confirmarAgendamentoFinal);
router.put('/agendamentos/:id/status', authMiddleware, agendamentoController.updateStatus);

// 🎯 5. Rotas de Comunicados (CORRIGE O ERRO 404)
// Estas rotas atendem as chamadas feitas no arquivo public/js/comunicados.js

// Listar o histórico e status de leitura dos comunicados
router.get('/comunicados/status', authMiddleware, comunicadoController.getComunicadosStatus);

// Enviar um novo comunicado (Massa ou Específico)
router.post('/comunicados', authMiddleware, comunicadoController.createComunicado);

// Rotas auxiliares para preencher os selects do formulário de comunicados
router.get('/comunicados/empresas', authMiddleware, comunicadoController.getEmpresas);
router.get('/comunicados/unidades-referencia', authMiddleware, comunicadoController.getUnidadesReferencia);


// =========================================================================
// ROTA PÚBLICA (NÃO EXIGE JWT)
// =========================================================================
// Exemplo de rota pública se necessário para a seleção de data pelo médico
// router.get('/public/agendamento/:id', agendamentoController.getPublicAgendamento);

module.exports = router;