// src/routes/authRoutes.js

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const agendamentoController = require('../controllers/agendamentoController'); // 💡 Controller de Agendamento

// Rota para cadastrar um novo usuário de acesso (Admin/Operador)
router.post('/register', authController.cadastrarUsuarioAcesso);

// Rota principal para o Login
router.post('/login', authController.login);

// =========================================================================
// ROTAS PÚBLICAS DE SERVIÇO (NÃO EXIGE LOGIN)
// =========================================================================

// 1. Endpoint para Confirmação de Treinamento por link/token (fluxo antigo, mantido)
// Acessível via POST para /auth/agendamentos/confirmar/{{token}}
router.post('/agendamentos/confirmar/:token', agendamentoController.confirmAgendamentoByToken);

// 2. ✅ NOVO: Endpoint para carregar os detalhes do convite (usado pelo selecionar-data.html)
// Acessível via GET para /auth/public/agendamentos/convite/{{id}}
router.get('/public/agendamentos/convite/:id', agendamentoController.getConviteDetails);

// 3. ✅ NOVO: Endpoint para registrar a data preferencial do médico (usado pelo selecionar-data.html)
// Acessível via POST para /auth/public/agendamentos/selecionar-data/{{id}}
router.post('/public/agendamentos/selecionar-data/:id', agendamentoController.receberSelecaoMedico);

module.exports = router;