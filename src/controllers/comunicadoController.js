// src/controllers/comunicadoController.js

const pool = require('../../db/config'); 
const logger = require('../../log/logger');
const { log } = require('console');

// =========================================================================
// FUNÇÃO ASSÍNCRONA: Processa o envio e rastreamento para cada médico
// =========================================================================

const processarEnvioComunicado = async (comunicadoId, publicoAlvo, referenciaId, referenciaType) => {
    logger.info(`Iniciando processo de envio assíncrono para o Comunicado ID ${comunicadoId}. Público: ${publicoAlvo}. Referência ID: ${referenciaId}`);
    
    try {
        // 1. Obter o conteúdo do comunicado
        const comunicadoResult = await pool.query('SELECT * FROM comunicados WHERE id = $1', [comunicadoId]);
        const comunicado = comunicadoResult.rows[0];
        
        if (!comunicado) {
            logger.error(`Comunicado ID ${comunicadoId} não encontrado durante o processamento.`);
            return;
        }

        // 2. Definir a Query para buscar os médicos alvos
        let medicosQuery = `
            SELECT m.id, m.nome, m.whatsapp 
            FROM medicos m
            WHERE m.ativo = TRUE 
            -- Filtra apenas médicos com número de WhatsApp (telefone)
            AND m.whatsapp IS NOT NULL AND m.whatsapp != ''
        `;
        const medicosValues = [];
        let medicoParamIndex = 1;

        if (publicoAlvo === 'EMPRESA' && referenciaId) {
            // referenciaId é a STRING (nome da empresa) aqui
            medicosQuery += ` AND m.empresa = $${medicoParamIndex++}`;
            medicosValues.push(referenciaId);

        } else if (publicoAlvo === 'UNIDADE' && referenciaId) {
            // referenciaId é o INTEGER (ID da unidade) aqui
            medicosQuery = `
                SELECT DISTINCT m.id, m.nome, m.whatsapp
                FROM medicos m
                JOIN medicos_unidades mu ON m.id = mu.medico_id
                WHERE m.ativo = TRUE AND m.whatsapp IS NOT NULL AND m.whatsapp != '' AND mu.unidade_id = $1
            `;
            medicosValues.push(referenciaId);
        } else if (publicoAlvo === 'TODOS_MEDICOS') {
            logger.info(`Comunicado ID ${comunicadoId}: Selecionando TODOS os médicos com WhatsApp.`);
        }
        
        const medicosResult = await pool.query(medicosQuery, medicosValues);
        const medicos = medicosResult.rows;
        
        logger.info(`Comunicado ID ${comunicadoId}: Encontrados ${medicos.length} médicos alvos.`);
        
        // 3. Preparar e Executar o Envio para Cada Médico (Simulação)
        const enviosPromises = medicos.map(async (medico) => {
            if (!medico.whatsapp) {
                logger.warn(`Médico ID ${medico.id} sem número de WhatsApp. Pulando envio.`);
                return { medicoId: medico.id, status: 'PULADO_SEM_WHATSAPP' };
            }

            // A. Gerar o link de rastreamento/ciência
            const insertResult = await pool.query(`
                INSERT INTO comunicados_medicos (comunicado_id, medico_id, status_envio, status_ciente)
                VALUES ($1, $2, 'AGUARDANDO', 'AGUARDANDO_CIENTE')
                RETURNING id
            `, [comunicadoId, medico.id]);
            
            const rastreamentoId = insertResult.rows[0].id; // UUID gerado (UUID no DB)
            
            // ATENÇÃO: Substituir 'seu-dominio.com' pelo domínio real da sua API/App
            const linkCiente = `https://seu-dominio.com/api/public/comunicado/ciente?id=${rastreamentoId}`;
            
            // B. Personalizar a mensagem (Usa RegEx para substituir todas as ocorrências)
            const mensagemPersonalizada = comunicado.conteudo
                .replace(/\[NOME_MEDICO\]/g, medico.nome)
                .replace(/\[LINK_CIENTE\]/g, linkCiente); 

            // C. SIMULAÇÃO DE ENVIO VIA WHATSAPP API (INTEGRE AQUI!)
            // const envioSucesso = await sendWhatsAppMessage(medico.whatsapp, mensagemPersonalizada);
            let envioSucesso = true; // SIMULAÇÃO
            
            if (envioSucesso) {
                // D. Atualizar status de envio e link de rastreamento
                await pool.query(`
                    UPDATE comunicados_medicos
                    SET status_envio = 'ENVIADO', data_envio = CURRENT_TIMESTAMP, link_rastreamento = $1
                    WHERE id = $2
                `, [linkCiente, rastreamentoId]);
                
                return { medicoId: medico.id, status: 'ENVIADO' };
            } else {
                 await pool.query(`
                    UPDATE comunicados_medicos
                    SET status_envio = 'ERRO'
                    WHERE id = $1
                `, [rastreamentoId]);
                return { medicoId: medico.id, status: 'ERRO' };
            }
        });
        
        // Espera todos os envios serem processados (capturando erros individuais)
        await Promise.all(enviosPromises.map(p => p.catch(e => {
             logger.error(`Erro durante o envio individual de comunicado: ${e.message}`);
             return { status: 'ERRO_INDIVIDUAL' };
        })));
        
        // 4. Atualizar o status geral do comunicado
        await pool.query('UPDATE comunicados SET data_envio_oficial = CURRENT_TIMESTAMP WHERE id = $1', [comunicadoId]);
        logger.audit(`Processo de envio assíncrono COMPLETO para o Comunicado ID ${comunicadoId}.`);

    } catch (error) {
        logger.error(`Erro fatal no processamento assíncrono do Comunicado ID ${comunicadoId}: ${error.message}`, { comunicado_id: comunicadoId, error_stack: error.stack });
    }
};


// =========================================================================
// ROTA PROTEGIDA: Cria e Salva o Comunicado (Dispara o processo acima)
// =========================================================================

const createComunicado = async (req, res) => {
    // user_id deve ser UUID. referência: req.user.id deve ser um UUID
    const user_id = req.user.id; 
    const { titulo, conteudo, publico_alvo, referencia_id, referencia_type } = req.body; 

    // Variáveis para armazenar o valor de referência ajustado para o DB (tipagem)
    let referenciaIdParaDb = null;
    let referenciaParaProcessamento = null;
    let referenciaTypeParaDb = null;


    // ----------------------------------------------------------------------
    // VALIDAÇÕES E AJUSTE DE TIPAGEM 🎯
    // ----------------------------------------------------------------------

    if (!titulo || titulo.trim().length === 0) {
        return res.status(400).json({ erro: 'O Título do comunicado é obrigatório.' });
    }
    if (!conteudo || conteudo.trim().length === 0) {
        return res.status(400).json({ erro: 'O Conteúdo do comunicado é obrigatório.' });
    }
    
    const ALVOS_VALIDOS = ['TODOS_MEDICOS', 'EMPRESA', 'UNIDADE'];
    if (!publico_alvo || !ALVOS_VALIDOS.includes(publico_alvo)) {
          return res.status(400).json({ erro: 'Público alvo inválido. Opções: TODOS_MEDICOS, EMPRESA, UNIDADE.' });
    }


    if (publico_alvo !== 'TODOS_MEDICOS') {
        if (!referencia_id) {
            return res.status(400).json({ erro: `ID de referência (Empresa/Unidade) é obrigatório para o público ${publico_alvo}.` });
        }
        
        let checkQuery = '';
        let checkValue = '';

        if (publico_alvo === 'UNIDADE') {
            const parsedReferenciaId = parseInt(referencia_id, 10);
            if (isNaN(parsedReferenciaId)) {
                return res.status(400).json({ erro: `ID de referência da Unidade deve ser um número inteiro válido.` });
            }
            
            // 🎯 AJUSTE DE TIPAGEM: UNIDADE usa o ID (INTEGER) tanto para DB quanto para Processamento
            referenciaIdParaDb = parsedReferenciaId;
            referenciaParaProcessamento = parsedReferenciaId;
            referenciaTypeParaDb = 'UNIDADE';
            
            checkQuery = 'SELECT id FROM unidades WHERE id = $1';
            checkValue = parsedReferenciaId;

            if (referencia_type !== 'UNIDADE') {
                return res.status(400).json({ erro: 'O tipo de referência deve ser "UNIDADE" para este público.' });
            }

        } else if (publico_alvo === 'EMPRESA') {
            
            // 🎯 AJUSTE DE TIPAGEM: EMPRESA usa o NOME (STRING) para Processamento, mas a coluna DB é INTEGER (deve ser NULL)
            referenciaIdParaDb = null; // A coluna referencia_id no DB é INTEGER, deve ser NULL se for STRING
            referenciaParaProcessamento = referencia_id; // Passamos a STRING para o filtro de médicos
            referenciaTypeParaDb = 'EMPRESA';
            
            checkQuery = 'SELECT cliente FROM unidades WHERE cliente = $1 LIMIT 1';
            checkValue = referencia_id;

            if (referencia_type !== 'EMPRESA') {
                return res.status(400).json({ erro: 'O tipo de referência deve ser "EMPRESA" para este público.' });
            }
        }
        
        // Verificação se o ID/Nome existe no banco
        try {
            const checkResult = await pool.query(checkQuery, [checkValue]);
            if (checkResult.rows.length === 0) {
                return res.status(404).json({ erro: `${publico_alvo} com ID/Nome ${referencia_id} não encontrado(a).` });
            }
        } catch (dbError) {
             logger.error(`Erro ao verificar existência de ${publico_alvo}: ${dbError.message}`);
             return res.status(500).json({ erro: `Erro interno ao verificar o ID/Nome da referência.` });
        }

    } else {
        // publico_alvo === 'TODOS_MEDICOS'
        referenciaIdParaDb = null;
        referenciaParaProcessamento = null;
        referenciaTypeParaDb = 'TODOS'; 
    }
    
    // ----------------------------------------------------------------------
    
    try {
        // 1. Salvar o comunicado na tabela
        const insertQuery = `
            INSERT INTO comunicados (titulo, conteudo, publico_alvo, referencia_id, referencia_type, enviado_por_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, data_criacao
        `;
        
        // 🎯 INSERÇÃO: Usando a variável tipada corretamente
        const insertValues = [
            titulo, 
            conteudo, 
            publico_alvo, 
            referenciaIdParaDb, 
            referenciaTypeParaDb, 
            user_id 
        ];
        
        const result = await pool.query(insertQuery, insertValues);
        const comunicadoId = result.rows[0].id;
        
        logger.audit(`Novo comunicado ID ${comunicadoId} criado por Usuário ID ${user_id}.`);

        // 2. Disparar o processo de envio assíncrono 
        // 🎯 CORREÇÃO: Passando as variáveis de processamento ajustadas
        processarEnvioComunicado(comunicadoId, publico_alvo, referenciaParaProcessamento, referenciaTypeParaDb);
        
        // 3. Resposta imediata ao frontend
        return res.status(200).json({
            mensagem: 'Comunicado salvo. O envio assíncrono via WhatsApp foi iniciado.',
            comunicado: {
                id: comunicadoId,
                data_criacao: result.rows[0].data_criacao
            }
        });

    } catch (error) {
        logger.error(`Erro ao criar comunicado: ${error.message}`, { 
            user_id, 
            payload: req.body, 
            error_stack: error.stack 
        });
        return res.status(500).json({ 
            erro: 'Erro interno ao salvar o comunicado.',
            detalhe: error.message 
        });
    }
};


// =========================================================================
// ROTA PÚBLICA: Registra a Ciência (Acessada pelo link do WhatsApp)
// =========================================================================

const registerCiente = async (req, res) => {
    // O rastreamentoId é o UUID da tabela comunicados_medicos
    const rastreamentoId = req.query.id; 

    if (!rastreamentoId) {
        return res.status(400).send('ID de rastreamento de ciência inválido ou ausente.');
    }

    try {
        // 1. Atualizar o registro no banco de dados, se o status ainda for 'AGUARDANDO_CIENTE'
        const updateQuery = `
            UPDATE comunicados_medicos
            SET status_ciente = 'CIENTE', 
                data_ciente = CURRENT_TIMESTAMP
            WHERE id = $1 AND status_ciente = 'AGUARDANDO_CIENTE'
            RETURNING medico_id, comunicado_id
        `;
        
        const result = await pool.query(updateQuery, [rastreamentoId]);
        
        // 2. Tratar a resposta para o médico (HTML amigável)
        
        let medicoNome = 'Médico(a)';
        let comunicadoTitulo = 'Comunicado Oficial';

        // Tenta buscar as informações do médico e comunicado (para personalizar a mensagem)
        try {
             const infoResult = await pool.query(`
                 SELECT m.nome AS medico_nome, c.titulo AS comunicado_titulo
                 FROM comunicados_medicos cm
                 JOIN medicos m ON cm.medico_id = m.id
                 JOIN comunicados c ON cm.comunicado_id = c.id
                 WHERE cm.id = $1
             `, [rastreamentoId]);

             if (infoResult.rows.length > 0) {
                 medicoNome = infoResult.rows[0].medico_nome;
                 comunicadoTitulo = infoResult.rows[0].comunicado_titulo;
             }
        } catch (e) { 
            logger.warn(`Falha ao buscar info de médico/comunicado para ID ${rastreamentoId}: ${e.message}`);
        }


        if (result.rowCount === 0) {
            // Caso 1: ID inválido ou ciência já registrada
            logger.warn(`Tentativa de ciência duplicada/inválida para ID: ${rastreamentoId}`);
            
            return res.status(200).send(`
                <!DOCTYPE html><html><head><title>Ciência Registrada</title>
                <style>body{font-family: Arial, sans-serif; text-align: center; padding: 50px;} .success{color: #28a745;}</style>
                </head><body>
                <h2 class="success">✅ Ciência já Registrada</h2>
                <p>Olá Dr(a) ${medicoNome}, o registro de ciência para o comunicado <strong>"${comunicadoTitulo}"</strong> já havia sido confirmado anteriormente.</p>
                <p>Obrigado pela atenção.</p>
                </body></html>
            `);
        }

        // Caso 2: Sucesso na atualização (primeiro clique de Ciente)
        const medicoId = result.rows[0].medico_id;
        
        logger.audit(`Ciência registrada com sucesso para o Comunicado ID ${result.rows[0].comunicado_id} pelo Médico ID ${medicoId}.`, { medico_id: medicoId, rastreamento_id: rastreamentoId });

        // Resposta de sucesso em formato HTML amigável
        return res.status(200).send(`
            <!DOCTYPE html><html><head><title>Ciência Confirmada</title>
            <style>body{font-family: Arial, sans-serif; text-align: center; padding: 50px;} .success{color: #007bff;}</style>
            </head><body>
            <h2 class="success">👍 Sucesso!</h2>
            <p>Olá Dr(a) ${medicoNome}, sua ciência sobre o comunicado <strong>"${comunicadoTitulo}"</strong> foi registrada em nosso sistema com data e hora. </p>
            <p>Agradecemos a sua confirmação e colaboração.</p>
            </body></html>
        `);

    } catch (error) {
        logger.error(`Erro ao registrar ciência do comunicado: ${error.message}`, { rastreamentoId, error_stack: error.stack });
        return res.status(500).send('Erro interno ao processar a confirmação de ciência. Tente novamente mais tarde.');
    }
};


// =========================================================================
// ROTA PROTEGIDA: Obtém o Status de todos os Comunicados Enviados
// =========================================================================

const getComunicadosStatus = async (req, res) => {
    
    try {
        const query = `
            SELECT
                c.id,
                c.titulo,
                c.publico_alvo,
                c.data_envio_oficial,
                COUNT(cm.id) FILTER (WHERE cm.status_envio = 'ENVIADO') AS total_enviado,
                COUNT(cm.id) FILTER (WHERE cm.status_ciente = 'CIENTE') AS total_ciente
            FROM
                comunicados c
            LEFT JOIN
                comunicados_medicos cm ON c.id = cm.comunicado_id
            GROUP BY
                c.id
            ORDER BY
                c.data_envio_oficial DESC NULLS LAST;
        `;

        const result = await pool.query(query);
        const comunicados = result.rows.map(row => {
            const total_enviado = parseInt(row.total_enviado, 10) || 0;
            const total_ciente = parseInt(row.total_ciente, 10) || 0;
            
            let taxa = 0;
            if (total_enviado > 0) {
                taxa = (total_ciente / total_enviado) * 100;
            }

            return {
                id: row.id,
                titulo: row.titulo,
                publico_alvo: row.publico_alvo,
                data_envio_oficial: row.data_envio_oficial,
                total_enviado: total_enviado,
                total_ciente: total_ciente,
                taxa_ciente: taxa.toFixed(1) 
            };
        });
        
        return res.status(200).json(comunicados);

    } catch (error) {
        logger.error(`Erro ao buscar status dos comunicados: ${error.message}`, { error_stack: error.stack });
        return res.status(500).json({ erro: 'Erro interno ao buscar a lista de comunicados.' });
    }
};


// =========================================================================
// ROTA PROTEGIDA: Obtém os Detalhes de um Comunicado (Por Recipiente)
// =========================================================================

const getComunicadoDetails = async (req, res) => {
    const comunicadoId = req.params.id;
    
    if (!comunicadoId || isNaN(parseInt(comunicadoId))) {
        return res.status(400).json({ erro: 'ID do comunicado inválido.' });
    }
    
    try {
        // 1. Buscar o título do comunicado
        const comunicadoHeaderResult = await pool.query('SELECT titulo FROM comunicados WHERE id = $1', [comunicadoId]);
        if (comunicadoHeaderResult.rows.length === 0) {
            return res.status(404).json({ erro: 'Comunicado não encontrado.' });
        }
        const comunicadoTitulo = comunicadoHeaderResult.rows[0].titulo;

        // 2. Buscar os detalhes de envio e ciência para CADA médico
        const detailsQuery = `
            SELECT
                cm.id AS rastreamento_id,
                m.id AS medico_id,
                m.nome AS medico_nome,
                m.whatsapp,
                m.empresa AS empresa_nome, -- 🎯 USANDO A COLUNA EMPRESA (nome do cliente) NA TABELA MEDICOS
                cm.status_envio,
                cm.data_envio,
                cm.status_ciente,
                cm.data_ciente
            FROM
                comunicados_medicos cm
            JOIN
                medicos m ON cm.medico_id = m.id
            WHERE
                cm.comunicado_id = $1
            ORDER BY
                m.nome;
        `;
        
        const detailsResult = await pool.query(detailsQuery, [comunicadoId]);
        
        // 3. Formatar a resposta
        return res.status(200).json({
            comunicado_id: comunicadoId,
            titulo: comunicadoTitulo,
            total_recipients: detailsResult.rows.length,
            recipients: detailsResult.rows
        });

    } catch (error) {
        logger.error(`Erro ao buscar detalhes do comunicado ID ${comunicadoId}: ${error.message}`, { comunicadoId, error_stack: error.stack });
        return res.status(500).json({ erro: 'Erro interno ao buscar os detalhes do comunicado.' });
    }
};


// =================================================================
// EXPORTS (TODAS AS FUNÇÕES)
// =================================================================

module.exports = {
    createComunicado,
    registerCiente, 
    getComunicadosStatus,
    getComunicadoDetails,
};