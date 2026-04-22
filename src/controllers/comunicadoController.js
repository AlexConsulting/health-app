const pool = require('../../db/config'); 
const logger = require('../../log/logger');
const twilio = require('twilio');

// Configuração Twilio
const accountSid = 'AC5a3b91fd4de82857d82bca6694d75615';
const authToken = '60322b843f75a03d6c698229dce14dfd';
const client = twilio(accountSid, authToken);
const TWILIO_WHATSAPP_NUMBER = 'whatsapp:+14155238886'; // Número padrão do Sandbox

// =========================================================================
// 🎯 FUNÇÕES AUXILIARES PARA O FRONTEND
// =========================================================================

const getEmpresas = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DISTINCT empresa FROM medicos 
            WHERE empresa IS NOT NULL AND empresa != '' ORDER BY empresa ASC
        `);
        res.json(result.rows.map(row => row.empresa));
    } catch (error) {
        logger.error(`Erro ao buscar empresas: ${error.message}`);
        res.status(500).json({ erro: 'Erro ao carregar lista de empresas.' });
    }
};

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
// ⚙️ MOTOR DE ENVIOS (INTEGRADO COM TWILIO)
// =========================================================================

const processarEnvioComunicado = async (comunicadoId, publicoAlvo, referenciaId) => {
    logger.info(`[Twilio] 🚀 Iniciando motor de disparos para Comunicado ID ${comunicadoId}.`);
    
    try {
        const comunicadoRes = await pool.query('SELECT * FROM comunicados WHERE id = $1', [comunicadoId]);
        const comunicado = comunicadoRes.rows[0];
        if (!comunicado) {
            logger.warn(`[Twilio] Comunicado ${comunicadoId} não encontrado.`);
            return;
        }

        // Seleção de médicos baseada no público alvo
        let medicosQuery = `SELECT id, nome, telefone AS whatsapp FROM medicos WHERE ativo = TRUE AND telefone IS NOT NULL AND telefone != ''`;
        const medicosValues = [];

        if (publicoAlvo === 'EMPRESA') {
            medicosQuery += ` AND empresa = $1`;
            medicosValues.push(referenciaId);
        } else if (publicoAlvo === 'UNIDADE') {
            medicosQuery += ` AND unidade_id = $1`;
            medicosValues.push(referenciaId);
        }
        
        const medicosResult = await pool.query(medicosQuery, medicosValues);
        const medicos = medicosResult.rows;

        logger.info(`[Twilio] Público filtrado: ${medicos.length} médicos encontrados.`);

        for (const medico of medicos) {
            let trackId = null;
            try {
                // 1. Registra a intenção de envio no banco
                const trackRes = await pool.query(`
                    INSERT INTO comunicados_medicos (comunicado_id, medico_id, status_envio, status_ciente)
                    VALUES ($1, $2, 'PROCESSANDO', 'AGUARDANDO_CIENTE') RETURNING id
                `, [comunicadoId, medico.id]);
                
                trackId = trackRes.rows[0].id;

                // 2. Prepara o link de ciência e a mensagem
                // IMPORTANTE: Se usar localhost, a ciência só funciona no seu PC. 
                // Para produção, substitua localhost pelo seu IP ou domínio.
                const linkCiente = `http://localhost:3000/api/public/comunicado/ciente?id=${trackId}`;
                
                const mensagemFinal = comunicado.conteudo
                    .replace(/\[NOME_MEDICO\]/g, medico.nome)
                    .replace(/\[LINK_CIENTE\]/g, linkCiente);

                // 3. Formatação rigorosa do número para o padrão E.164 (Twilio)
                const numeroLimpo = medico.whatsapp.replace(/\D/g, '');
                const toPhone = `whatsapp:+${numeroLimpo.startsWith('55') ? numeroLimpo : '55' + numeroLimpo}`;

                logger.info(`[Twilio] Disparando para ${medico.nome} (${toPhone})...`);

                // 4. Chamada da API do Twilio
                const messageResponse = await client.messages.create({
                    from: TWILIO_WHATSAPP_NUMBER,
                    body: mensagemFinal,
                    to: toPhone
                });

                logger.info(`[Twilio] ✅ Sucesso no disparo! SID: ${messageResponse.sid}`);

                // 5. Atualiza o banco com sucesso
                await pool.query(`
                    UPDATE comunicados_medicos 
                    SET status_envio = 'ENVIADO', 
                        data_envio = CURRENT_TIMESTAMP, 
                        link_rastreamento = $1 
                    WHERE id = $2
                `, [linkCiente, trackId]);

            } catch (err) {
                // LOG DE ERRO DETALHADO DO TWILIO
                logger.error(`[Twilio] ❌ Falha no envio para ${medico.nome} (ID ${medico.id}): ${err.message}`);
                
                if (trackId) {
                    await pool.query(`
                        UPDATE comunicados_medicos 
                        SET status_envio = 'ERRO' 
                        WHERE id = $1
                    `, [trackId]);
                }
            }
        }
        
        // Finalização do status global do comunicado
        await pool.query('UPDATE comunicados SET data_envio_oficial = CURRENT_TIMESTAMP WHERE id = $1', [comunicadoId]);
        logger.info(`[Twilio] 🏁 Processamento do Comunicado ${comunicadoId} finalizado.`);

    } catch (error) {
        logger.error(`[Twilio] 🚨 Erro crítico no motor de envios: ${error.message}`);
    }
};

// =========================================================================
// 📄 ROTAS PRINCIPAIS
// =========================================================================

const createComunicado = async (req, res) => {
    const user_id = req.user ? req.user.id : null; 
    const { titulo, conteudo, publico_alvo, referencia_id } = req.body; 

    if (!titulo || !conteudo) {
        return res.status(400).json({ erro: 'Título e conteúdo são obrigatórios.' });
    }

    try {
        const publicoAlvoDb = publico_alvo.toUpperCase(); 
        const isUnidade = publicoAlvoDb === 'UNIDADE';
        const refIdDb = (isUnidade && referencia_id) ? parseInt(referencia_id, 10) : null;
        const refTypeDb = (publicoAlvoDb === 'EMPRESA') ? referencia_id : publicoAlvoDb;

        const insertRes = await pool.query(`
            INSERT INTO comunicados (titulo, conteudo, publico_alvo, referencia_id, referencia_type, enviado_por_id, data_criacao)
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) RETURNING id
        `, [
            titulo, 
            conteudo, 
            publicoAlvoDb, 
            (isNaN(refIdDb) ? null : refIdDb), 
            refTypeDb, 
            user_id
        ]);
        
        const comunicadoId = insertRes.rows[0].id;
        const refParaBusca = (publicoAlvoDb === 'EMPRESA') ? referencia_id : refIdDb;

        // Inicia disparos em background (não bloqueia a resposta do site)
        processarEnvioComunicado(comunicadoId, publicoAlvoDb, refParaBusca);
        
        return res.status(200).json({
            mensagem: 'Comunicado registrado e fila de disparos iniciada.',
            comunicado: { id: comunicadoId }
        });

    } catch (error) {
        logger.error(`[Controller Comunicados] Erro ao criar: ${error.message}`);
        res.status(500).json({ erro: 'Erro interno ao salvar comunicado.' });
    }
};

const registerCiente = async (req, res) => {
    const trackId = req.query.id; 
    if (!trackId) return res.status(400).send('Link inválido.');

    try {
        const resDb = await pool.query(`
            UPDATE comunicados_medicos SET status_ciente = 'CIENTE', data_ciente = CURRENT_TIMESTAMP
            WHERE id = $1 AND status_ciente = 'AGUARDANDO_CIENTE' RETURNING id
        `, [trackId]);
        
        const template = (status, msg) => `
            <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ciência</title>
            <style>body{font-family:sans-serif;text-align:center;padding:50px;background:#f4f7f6;} 
            .box{background:white;border:1px solid #ddd;padding:30px;display:inline-block;border-radius:10px;box-shadow:0 4px 6px rgba(0,0,0,0.1);}</style>
            </head><body><div class="box"><h2>${status}</h2><p>${msg}</p></div></body></html>
        `;

        if (resDb.rowCount === 0) return res.status(200).send(template('Atenção', 'Esta ciência já foi confirmada anteriormente.'));
        return res.status(200).send(template('Sucesso!', 'Sua ciência foi registrada com sucesso. Obrigado!'));
    } catch (error) {
        return res.status(500).send('Erro ao processar ciência.');
    }
};

const getComunicadosStatus = async (req, res) => {
    try {
        const query = `
            SELECT c.id, c.titulo, c.publico_alvo, 
                COALESCE(c.data_envio_oficial, c.data_criacao) as data_envio_oficial,
                COUNT(cm.id) FILTER (WHERE cm.status_envio = 'ENVIADO') AS total_enviado,
                COUNT(cm.id) FILTER (WHERE cm.status_ciente = 'CIENTE') AS total_ciente
            FROM comunicados c
            LEFT JOIN comunicados_medicos cm ON c.id = cm.comunicado_id
            GROUP BY c.id ORDER BY c.id DESC;
        `;
        const result = await pool.query(query);
        const formatado = result.rows.map(row => ({
            ...row,
            taxa_ciente: row.total_enviado > 0 ? ((row.total_ciente / row.total_enviado) * 100).toFixed(1) : "0.0"
        }));
        res.status(200).json(formatado);
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao listar status.' });
    }
};

const getComunicadoDetails = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id || isNaN(parseInt(id))) return res.status(200).json([]);

        const result = await pool.query(`
            SELECT 
                cm.id, 
                m.nome as medico_nome, 
                m.telefone as whatsapp, 
                cm.status_envio, 
                cm.data_envio, 
                cm.status_ciente, 
                cm.data_ciente
            FROM comunicados_medicos cm 
            INNER JOIN medicos m ON cm.medico_id = m.id
            WHERE cm.comunicado_id = $1 
            ORDER BY m.nome ASC;
        `, [id]);

        res.status(200).json(result.rows || []);
    } catch (error) {
        logger.error(`[Controller Detalhes] Erro: ${error.message}`);
        res.status(200).json([]); 
    }
};

module.exports = {
    createComunicado, registerCiente, getComunicadosStatus,
    getComunicadoDetails, getEmpresas, getUnidadesReferencia
};