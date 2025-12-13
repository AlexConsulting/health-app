// src/controllers/empresaController.js

const pool = require('../../db/config');
const logger = require('../../log/logger');

// Esta função retorna uma lista DISTINTA de clientes/empresas
// usando a coluna 'cliente' da tabela 'unidades'.
const getEmpresas = async (req, res) => {
    logger.info(`Usuário ID ${req.user.id} buscando lista de clientes/empresas (da tabela unidades).`);
    try {
        // 🎯 CORREÇÃO DA QUERY:
        // 1. Usa a tabela 'unidades' (que existe no BD).
        // 2. Usa DISTINCT para obter nomes de clientes únicos.
        // 3. Renomeia o campo 'cliente' como 'nome' para o frontend.
        // 4. Usa o nome do cliente como 'id' (para simplificar o mapeamento no frontend).
        const query = `
            SELECT DISTINCT 
                cliente AS id, 
                cliente AS nome 
            FROM unidades 
            WHERE cliente IS NOT NULL AND cliente != '' 
            ORDER BY nome
        `;

        const { rows } = await pool.query(query);
        
        return res.status(200).json({ 
            // O frontend espera o array dentro da chave 'empresas'
            empresas: rows 
        });

    } catch (error) {
        logger.error(`Erro ao buscar clientes/empresas na tabela unidades: ${error.message}`, { 
            user_id: req.user.id,
            error_stack: error.stack 
        });
        
        return res.status(500).json({ 
            erro: 'Erro interno ao carregar a lista de empresas (clientes). ' + error.message 
        });
    }
};

module.exports = {
    getEmpresas,
};