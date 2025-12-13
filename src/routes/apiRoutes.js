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
const empresaController = require('../controllers/empresaController'); // 🎯 NOVO CONTROLLER ADICIONADO

// =========================================================================
// ROTAS PROTEGIDAS (ADMIN - EXIGE JWT)
// =========================================================================

// 1. Rotas de Unidades
router.get('/unidades', authMiddleware, unidadeController.getUnidades);

// 2. Rotas do Dashboard
router.get('/dashboard/kpis', authMiddleware, dashboardController.getKpis);
router.get('/dashboard/pendencias', authMiddleware, dashboardController.getPendenciasOperacionais);

// 3. Rotas de Médico (CRUD)
router.post('/medicos', authMiddleware, medicoController.createMedico); 
router.get('/medicos', authMiddleware, medicoController.getMedicos); 
router.get('/medicos/:id', authMiddleware, medicoController.getMedicoById); 
router.put('/medicos/:id', authMiddleware, medicoController.updateMedico);
router.delete('/medicos/:id', authMiddleware, medicoController.deleteMedico); 
router.get('/medicos/sem-agendamento', authMiddleware, medicoController.getMedicosSemAgendamento); 

// 4. Rotas de Agendamento/Treinamento (Integração e Status)
router.get('/agendamentos', authMiddleware, agendamentoController.getAgendamentos);
router.post('/agendamentos', authMiddleware, agendamentoController.createAgendamento); 
router.put('/agendamentos/confirmar-final/:id', authMiddleware, agendamentoController.confirmarAgendamentoFinal);
router.put('/agendamentos/:id/status', authMiddleware, agendamentoController.updateStatus);

// 5. Rotas de Agendamento de ATIVAÇÃO ASSISTIDA
// ROTA 7: Enviar Convite de Agendamento de Ativação (Admin)
router.put('/agendamentos/ativacao/convite/:id', authMiddleware, agendamentoController.enviarConviteAtivacao);

// ROTA 9: Confirmar Agendamento de Ativação Final (Admin)
router.put('/agendamentos/ativacao/confirmar/:id', authMiddleware, agendamentoController.confirmarAgendamentoAtivacao);


// 6. Rotas de COMUNICADOS (ADMIN) 
router.post('/comunicados', authMiddleware, comunicadoController.createComunicado);
router.get('/comunicados/status', authMiddleware, comunicadoController.getComunicadosStatus); // Rota para listagem geral
router.get('/comunicados/detalhes/:id', authMiddleware, comunicadoController.getComunicadoDetails); // Rota para detalhes por destinatário

// 7. Rotas de EMPRESAS/REFERÊNCIA 🎯 ROTA ADICIONADA PARA RESOLVER O 404
router.get('/empresas', authMiddleware, empresaController.getEmpresas); 

// =========================================================================
// ROTAS PÚBLICAS (NÃO EXIGE JWT)
// Estas rotas devem ser acessíveis publicamente via link (WhatsApp)
// =========================================================================

// 8. Rotas PÚBLICAS de Agendamento (Integração)
// Rota de Confirmação Final do Meet de Integração (Rota 3)
router.put('/agendamentos/confirmar/:token', agendamentoController.confirmAgendamentoByToken);

// Rota PÚBLICA de Detalhes do Convite de Integração (Rota 4)
router.get('/agendamentos/convite/:id', agendamentoController.getConviteDetails);

// Rota PÚBLICA de Recebimento da Seleção de Data do Meet de Integração (Rota 5)
router.post('/agendamentos/selecao/:id', agendamentoController.receberSelecaoMedico);


// 9. Rotas PÚBLICAS de Agendamento (Ativação)
// Rota PÚBLICA de Recebimento da Seleção de Data do Meet de Ativação (Rota 8)
router.post('/agendamentos/ativacao/selecao/:id', agendamentoController.receberSelecaoAtivacao);

// Rota PÚBLICA para Carregar Detalhes de Agendamento de Ativação
router.get('/agendamentos/ativacao/publico/:id', agendamentoController.getAgendamentoAtivacaoPublico);

// 10. Rota PÚBLICA de Confirmação de Ciência de Comunicado (WhatsApp) 
router.get('/public/comunicado/ciente', comunicadoController.registerCiente);


module.exports = router;