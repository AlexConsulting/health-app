// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const logger = require('../../log/logger');

const JWT_SECRET = process.env.JWT_SECRET;

const authMiddleware = (req, res, next) => {
    // 1. Tenta obter o token do cabeçalho 'Authorization'
    // Formato esperado: Authorization: Bearer <token>
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // Loga a tentativa de acesso não autorizado
        logger.audit('Acesso bloqueado: Token ausente ou formato inválido.', { ip_address: req.ip });
        return res.status(401).json({ erro: 'Acesso negado. Token não fornecido.' });
    }

    // Extrai o token removendo o prefixo 'Bearer '
    const token = authHeader.split(' ')[1];

    try {
        // 2. Verifica e decodifica o token usando o segredo
        const decoded = jwt.verify(token, JWT_SECRET);

        // 3. Anexa as informações decodificadas do usuário (id, nome, role) à requisição
        req.user = decoded; 
        
        // 4. Continua para a próxima função da rota
        next();

    } catch (error) {
        // Token inválido (expirado, modificado, etc.)
        logger.audit('Acesso bloqueado: Token inválido.', { ip_address: req.ip, token_error: error.message });
        return res.status(401).json({ erro: 'Token inválido ou expirado.' });
    }
};

module.exports = authMiddleware;