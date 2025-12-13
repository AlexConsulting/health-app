// src/controllers/unidadeController.js

// CORREÇÃO: Usar '../../db/config' para subir da pasta 'controllers' para a raiz e acessar 'db/config.js'
const pool = require('../../db/config'); 
const logger = require('../../log/logger');

// Função para buscar todas as unidades no banco de dados
const getUnidades = async (req, res) => {
    // A requisição só chega aqui se o token JWT for válido
    logger.info(`Usuário ID ${req.user.id} buscando lista de unidades.`);
    
    try {
        // Query SQL para selecionar ID e Nome, ordenando pelo Nome (removida cláusula 'ativo' não confirmada).
        // Exemplo (depois)
		const query = 'SELECT id, nome, cliente, cidade, estado FROM unidades ORDER BY nome';
        
        const { rows } = await pool.query(query);
        
        // Retorna a lista de unidades para o frontend
        return res.status(200).json({ 
            mensagem: 'Lista de unidades carregada com sucesso.',
            unidades: rows 
        });

    } catch (error) {
        logger.error(`Erro ao buscar unidades: ${error.message}`, { 
            user_id: req.user.id, 
            error_stack: error.stack 
        });
        return res.status(500).json({ 
            erro: 'Erro interno ao carregar as unidades.' 
        });
    }
};

module.exports = {
    getUnidades,
};