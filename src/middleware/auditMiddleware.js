// src/middleware/auditMiddleware.js
const logger = require('../../log/logger');

const auditMiddleware = (action) => (req, res, next) => {
    // Estas informações de usuário estarão disponíveis após o login (com JWT)
    const userId = req.user ? req.user.id : 'N/A'; 
    const userName = req.user ? req.user.nome : 'Visitante';
    const ip = req.ip || req.connection.remoteAddress;

    // Registra a auditoria
    logger.audit(`Ação no Sistema: ${action}`, {
        user_id: userId,
        user_nome: userName,
        method: req.method,
        url: req.originalUrl,
        ip_address: ip,
        body_keys: Object.keys(req.body || {}), // Loga apenas as chaves do corpo, não o conteúdo sensível
    });

    next(); // Continua para a próxima função da rota
};

module.exports = auditMiddleware;