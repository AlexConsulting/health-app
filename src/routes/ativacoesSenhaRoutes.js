// src/routes/ativacoesSenhaRoutes.js

const express = require('express');
const router = express.Router();
const ativacoesController = require('../controllers/ativacoesSenhaController');
// const authMiddleware = require('../middlewares/authMiddleware'); // Assumindo seu middleware de autenticação

// 1. Rota para o frontend do médico/admin buscar os horários disponíveis
// Ex: GET /api/ativacoes/janelas?data=2025-12-15
router.get('/janelas', ativacoesController.getJanelasDisponiveis);

// 2. Rota para o médico confirmar a data e horário
// Ex: POST /api/ativacoes/agendar
router.post('/agendar', ativacoesController.agendarAtivacaoSenha); 

// Você pode precisar adicionar rotas de autenticação (authMiddleware) aqui dependendo
// de quem está fazendo a requisição (Admin ou Médico logado).

module.exports = router;