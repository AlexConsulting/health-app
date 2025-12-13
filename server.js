// server.js
// by Alex Silva - 2025

const express = require('express');
require('dotenv').config();
const path = require('path');
const logger = require('./log/logger');

// === 1. IMPORTAR ROTAS E CONEXÃO ===
const db = require('./db/config'); // Sua conexão com o banco de dados
const authRoutes = require('./src/routes/authRoutes'); // Rotas de Login/Cadastro (Públicas)
const apiRoutes = require('./src/routes/apiRoutes'); // Rotas de API (Protegidas por JWT)

const app = express();
const PORT = process.env.PORT || 3000;

// === 2. MIDDLEWARES GERAIS ===

// Processa requisições com corpo JSON
app.use(express.json());
// Processa requisições de formulário (urlencoded)
app.use(express.urlencoded({ extended: true }));

// LOGS: Middleware para registrar cada requisição recebida
app.use((req, res, next) => {
    logger.info(`Requisição recebida: ${req.method} ${req.originalUrl}`);
    next();
});

// Servir arquivos estáticos (HTML, CSS, JS) da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));


// === 3. USO DAS ROTAS ===

// Rotas de Autenticação (Login, Cadastro de Acesso) - PÚBLICAS
app.use('/auth', authRoutes); 

// Rotas da API Principal (Dashboard, Unidades, Médicos, etc.) - PROTEGIDAS
// Todas as rotas em apiRoutes serão acessadas via /api/...
app.use('/api', apiRoutes); // ✅ REGISTRO CORRETO AQUI


// === 4. ROTA PRINCIPAL (Landing Page) ===

// Redireciona a raiz da aplicação para a página de Login
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});


// === 5. TRATAMENTO DE 404 (Not Found) PARA API ===
// NOVO: Captura qualquer requisição /api/* que não foi tratada pelas rotas definidas acima
// Isso garante que o frontend receba JSON e não HTML em caso de 404.
app.use('/api', (req, res) => {
    logger.audit(`404: Recurso de API não encontrado: ${req.originalUrl}`);
    return res.status(404).json({ erro: `Recurso da API não encontrado.` });
});


// === 6. TRATAMENTO DE ERROS (500) ===

// Middleware de tratamento de erros genérico (DEVE ser o último app.use)
app.use((err, req, res, next) => {
    // Registra o erro detalhado no log/app_log.log
    logger.error(`Erro: ${err.message}`, { stack: err.stack, method: req.method, url: req.originalUrl });
    
    // Resposta para o cliente
    res.status(500).json({ 
        erro: 'Ocorreu um erro interno do servidor.',
        detalhe: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
});

// === 7. INICIALIZAÇÃO ===

// Inicia o servidor Express
app.listen(PORT, () => {
    logger.info(`🚀 Servidor rodando em http://localhost:${PORT}`);
});