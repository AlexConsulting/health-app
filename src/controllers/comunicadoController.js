// src/controllers/comunicadoController.js

const pool = require('../../db/config'); 
const logger = require('../../log/logger');

// =========================================================================
// 🎯 FUNÇÕES AUXILIARES PARA O FRONTEND (Preenchimento de Selects)
// =========================================================================

/**
 * Busca a lista de empresas (clientes) baseada na coluna 'empresa' da tabela de médicos
 */
const getEmpresas = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DISTINCT empresa 
            FROM medicos 
            WHERE empresa IS NOT NULL AND empresa != '' 
            ORDER BY empresa ASC
        `);
        res.json(result.rows.map(row => row.empresa));
    } catch (error) {
        logger.error(`Erro ao buscar empresas: ${error.message}`);
        res.status(500).json({ erro: 'Erro ao carregar lista de empresas.' });
    }
};

/**
 * Busca a lista de unidades de referência da tabela 'unidades'
 */
const getUnidadesReferencia = async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nome FROM unidades ORDER BY nome ASC');
        res.json(result.rows);
    } catch (error) {
        logger.error(`Erro ao buscar unidades: ${error.message}`);
        res.status(500).json({ erro: 'Erro ao carregar lista de unidades.' });
    }
};

// =========================================================================
// ⚙️ PROCESSAMENTO ASSÍNCRONO: O "Motor" de Envios
// =========================================================================

const processarEnvioComunicado = async (comunicadoId, publicoAlvo, referenciaId, referenciaType) => {
    logger.info(`[Background] Iniciando processamento para Comunicado ID ${comunicadoId}.`);
    
    try {
        // 1. Recupera o conteúdo integral do comunicado
        const comunicadoResult = await pool.query('SELECT * FROM comunicados WHERE id = $1', [comunicadoId]);
        const comunicado = comunicadoResult.rows[0];
        
        if (!comunicado) {
            logger.error(`[Background] Comunicado ${comunicadoId} não encontrado.`);
            return;
        }

        // 2. Constrói a Query de Médicos Alvos (Mantendo a lógica de filtros)
        let medicosQuery = `
            SELECT m.id, m.nome, m.whatsapp 
            FROM medicos m
            WHERE m.ativo = TRUE 
            AND m.whatsapp IS NOT NULL AND m.whatsapp != ''
        `;
        const medicosValues = [];

        if (publicoAlvo === 'EMPRESA' && referenciaId) {
            medicosQuery += ` AND m.empresa = $1`;
            medicosValues.push(referenciaId);
        } else if (publicoAlvo === 'UNIDADE' && referenciaId) {
            medicosQuery = `
                SELECT DISTINCT m.id, m.nome, m.whatsapp
                FROM medicos m
                JOIN medicos_unidades mu ON m.id = mu.medico_id
                WHERE m.ativo = TRUE AND m.whatsapp IS NOT NULL AND m.whatsapp != '' AND mu.unidade_id = $1
            `;
            medicosValues.push(referenciaId);
        }
        
        const medicosResult = await pool.query(medicosQuery, medicosValues);
        const medicos = medicosResult.rows;
        logger.info(`[Background] Comunicado ${comunicadoId}: ${medicos.length} destinatários encontrados.`);

        // 3. Mapeamento de Envios (Processamento em paralelo)
        const enviosPromises = medicos.map(async (medico) => {
            try {
                // A. Cria o registro de rastreamento (UUID automático no DB)
                const insertResult = await pool.query(`
                    INSERT INTO comunicados_medicos (comunicado_id, medico_id, status_envio, status_ciente)
                    VALUES ($1, $2, 'AGUARDANDO', 'AGUARDANDO_CIENTE')
                    RETURNING id
                `, [comunicadoId, medico.id]);
                
                const rastreamentoId = insertResult.rows[0].id;
                const linkCiente = `https://seu-dominio.com/api/public/comunicado/ciente?id=${rastreamentoId}`;
                
                // B. Personalização dinâmica do conteúdo
                const mensagemFinal = comunicado.conteudo
                    .replace(/\[NOME_MEDICO\]/g, medico.nome)
                    .replace(/\[LINK_CIENTE\]/g, linkCiente);

                // C. Integração WhatsApp (Simulada - Substituir pela chamada da API real)
                let envioSucesso = true; 

                if (envioSucesso) {
                    await pool.query(`
                        UPDATE comunicados_medicos
                        SET status_envio = 'ENVIADO', data_envio = CURRENT_TIMESTAMP, link_rastreamento = $1
                        WHERE id = $2
                    `, [linkCiente, rastreamentoId]);
                } else {
                    await pool.query(`UPDATE comunicados_medicos SET status_envio = 'ERRO' WHERE id = $1`, [rastreamentoId]);
                }
            } catch (err) {
                logger.error(`Erro no destinatário ${medico.id}: ${err.message}`);
            }
        });
        
        await Promise.all(enviosPromises);
        
        // 4. Marca finalização oficial
        await pool.query('UPDATE comunicados SET data_envio_oficial = CURRENT_TIMESTAMP WHERE id = $1', [comunicadoId]);
        logger.audit(`[Background] Comunicado ID ${comunicadoId} finalizado com sucesso.`);

    } catch (error) {
        logger.error(`[Background] Erro crítico no Comunicado ${comunicadoId}: ${error.message}`);
    }
};

// =========================================================================
// 📄 ROTAS PRINCIPAIS (Controllers expostos para as rotas)
// =========================================================================

const createComunicado = async (req, res) => {
    const user_id = req.user.id; 
    const { titulo, conteudo, publico_alvo, referencia_id, referencia_type } = req.body; 

    // Validações de sanidade
    if (!titulo || titulo.trim() === '') return res.status(400).json({ erro: 'Título é obrigatório.' });
    if (!conteudo || conteudo.trim() === '') return res.status(400).json({ erro: 'Conteúdo é obrigatório.' });

    let refIdDb = null;
    let refProc = null;
    let refTypeDb = publico_alvo === 'TODOS_MEDICOS' ? 'TODOS' : publico_alvo;

    // Lógica de tipos para o Banco de Dados
    if (publico_alvo === 'UNIDADE') {
        refIdDb = parseInt(referencia_id, 10);
        refProc = refIdDb;
    } else if (publico_alvo === 'EMPRESA') {
        refIdDb = null; // Coluna INT no DB não aceita String
        refProc = referencia_id; // String do nome da empresa para a query
    }
    
    try {
        const insertResult = await pool.query(`
            INSERT INTO comunicados (titulo, conteudo, publico_alvo, referencia_id, referencia_type, enviado_por_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, data_criacao
        `, [titulo, conteudo, publico_alvo, refIdDb, refTypeDb, user_id]);
        
        const comunicadoId = insertResult.rows[0].id;
        
        // Disparo assíncrono (Fire and Forget)
        processarEnvioComunicado(comunicadoId, publico_alvo, refProc, refTypeDb);
        
        return res.status(200).json({
            mensagem: 'Comunicado salvo com sucesso. Processamento de envio em curso.',
            comunicado: { id: comunicadoId, data_criacao: insertResult.rows[0].data_criacao }
        });

    } catch (error) {
        logger.error(`Erro ao salvar comunicado: ${error.message}`);
        return res.status(500).json({ erro: 'Erro interno ao salvar o comunicado.' });
    }
};

const registerCiente = async (req, res) => {
    const rastreamentoId = req.query.id; 
    if (!rastreamentoId) return res.status(400).send('ID de rastreamento inválido.');

    try {
        const result = await pool.query(`
            UPDATE comunicados_medicos
            SET status_ciente = 'CIENTE', data_ciente = CURRENT_TIMESTAMP
            WHERE id = $1 AND status_ciente = 'AGUARDANDO_CIENTE'
            RETURNING medico_id, comunicado_id
        `, [rastreamentoId]);
        
        // Template HTML para resposta ao médico
        const template = (status, msg) => `
            <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ciência</title>
            <style>body{font-family:sans-serif;text-align:center;padding:50px;} .box{border:1px solid #ddd;padding:20px;display:inline-block;border-radius:10px;} .blue{color:#007bff;}</style>
            </head><body><div class="box"><h2 class="blue">${status}</h2><p>${msg}</p></div></body></html>
        `;

        if (result.rowCount === 0) {
            return res.status(200).send(template('Ciência Confirmada', 'Esta ciência já foi registrada anteriormente em nosso sistema.'));
        }

        return res.status(200).send(template('Sucesso!', 'A sua ciência foi registrada com data e hora. Obrigado pela atenção.'));
    } catch (error) {
        logger.error(`Erro ciência: ${error.message}`);
        return res.status(500).send('Erro ao processar a ciência.');
    }
};

const getComunicadosStatus = async (req, res) => {
    try {
        const query = `
            SELECT c.id, c.titulo, c.publico_alvo, c.data_envio_oficial,
                COUNT(cm.id) FILTER (WHERE cm.status_envio = 'ENVIADO') AS total_enviado,
                COUNT(cm.id) FILTER (WHERE cm.status_ciente = 'CIENTE') AS total_ciente
            FROM comunicados c
            LEFT JOIN comunicados_medicos cm ON c.id = cm.comunicado_id
            GROUP BY c.id
            ORDER BY c.data_envio_oficial DESC NULLS LAST;
        `;
        const result = await pool.query(query);
        const formatado = result.rows.map(row => ({
            ...row,
            taxa_ciente: row.total_enviado > 0 ? ((row.total_ciente / row.total_enviado) * 100).toFixed(1) : "0.0"
        }));
        return res.status(200).json(formatado);
    } catch (error) {
        return res.status(500).json({ erro: 'Erro ao buscar lista de comunicados.' });
    }
};

const getComunicadoDetails = async (req, res) => {
    const comunicadoId = req.params.id;
    try {
        const result = await pool.query(`
            SELECT cm.id, m.nome as medico_nome, m.whatsapp, cm.status_envio, cm.data_envio, cm.status_ciente, cm.data_ciente
            FROM comunicados_medicos cm
            JOIN medicos m ON cm.medico_id = m.id
            WHERE cm.comunicado_id = $1 ORDER BY m.nome;
        `, [comunicadoId]);
        res.status(200).json(result.rows);
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao buscar detalhes do comunicado.' });
    }
};

// =========================================================================
// EXPORTS
// =========================================================================

module.exports = {
    createComunicado,
    registerCiente, 
    getComunicadosStatus,
    getComunicadoDetails,
    getEmpresas,
    getUnidadesReferencia
};