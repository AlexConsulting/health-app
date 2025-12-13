// src/controllers/agendamentoController.js

const pool = require('../../db/config'); 
const logger = require('../../log/logger');
const { v4: uuidv4 } = require('uuid'); 

// Função auxiliar para gerar um token único
function generateConfirmationToken() {
    return uuidv4();
}

// =================================================================
// 0. CREATE (Cadastrar Novo Agendamento Individual)
// =================================================================

const createAgendamento = async (req, res) => {
    const user_id = req.user.id;
    const { medico_id, unidade_id, data_integracao, horario, pals, acls } = req.body; 

    if (!medico_id || !unidade_id) {
        return res.status(400).json({ erro: 'ID do médico e ID da unidade são obrigatórios.' });
    }

    // LÓGICA DE STATUS CONDICIONAL: 
    const isPending = !data_integracao || !horario;
    const status_agendamento = isPending ? 'PENDENTE' : 'AGENDADO'; 
    
    // O token só é necessário se for AGENDADO (para confirmação via link)
    const token_confirmacao = isPending ? null : generateConfirmationToken();

    try {
        const query = `
            INSERT INTO agendamentos (
                medico_id, 
                unidade_id, 
                data_integracao,
                horario,
                pals,
                acls,
                status, 
                token_confirmacao,
                criado_por
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, medico_id, data_integracao, horario, status, token_confirmacao
        `;
        const values = [
            medico_id, 
            unidade_id, 
            data_integracao || null, 
            horario || null, 
            pals || false, 
            acls || false,
            status_agendamento, 
            token_confirmacao,
            user_id 
        ];

        const { rows } = await pool.query(query, values);
        const novoAgendamento = rows[0];

        logger.audit(`Agendamento (Status: ${status_agendamento}) criado para o médico ID ${medico_id}.`, { user_id, agendamento_id: novoAgendamento.id });
        
        return res.status(201).json({ 
            mensagem: `Agendamento criado com sucesso (Status: ${status_agendamento}).`, 
            agendamento: novoAgendamento 
        });

    } catch (error) {
        logger.error(`Erro ao criar agendamento: ${error.message}`, { user_id, error_stack: error.stack });
        return res.status(500).json({ erro: 'Erro interno ao registrar o agendamento.' });
    }
};

// =================================================================
// 1. READ (Listar Agendamentos) - CORRIGIDO O ERRO DE SINTAXE DO 500
// =================================================================
const getAgendamentos = async (req, res) => {
    const user_id = req.user.id;
    // Adicionado medico_id aos filtros que podem vir da URL (req.query)
    const { data, status, medico_id, unidade_id } = req.query; 

    let query = `
        SELECT 
            a.id, 
            a.data_integracao, 
            a.horario, 
            a.status AS status, 
            a.pals,
            a.acls,
            a.data_preferencial,    -- Integração/Meet
            a.horario_preferencial, -- Integração/Meet
            a.data_ativacao,        -- NOVO: Data Ativação
            a.horario_ativacao,     -- NOVO: Horário Ativação
            m.nome AS medico_nome, 
            m.crm AS medico_crm, 
            m.telefone AS medico_telefone, 
            u.nome AS unidade_nome
        FROM agendamentos a
        JOIN medicos m ON a.medico_id = m.id
        JOIN unidades u ON a.unidade_id = u.id 
        WHERE 1=1 `; // Ponto de partida seguro para a cláusula WHERE
    
    const values = [];
    let paramCount = 1;

    // 1. Filtro por Data
    if (data) {
        // Busca em data_integracao OU data_ativacao (usando o mesmo placeholder $1)
        query += ` AND (a.data_integracao = $${paramCount} OR a.data_ativacao = $${paramCount}) `;
        values.push(data);
        paramCount++;
    }

    // 2. Filtro por Status (Corrigido para aceitar múltiplos valores, ex: status=PENDENTE,AGENDADO)
    if (status) {
        const statusArray = status.split(',').map(s => s.trim()).filter(s => s.length > 0);
        if (statusArray.length > 0) {
            // Cria placeholders dinâmicos (ex: $2, $3, $4) para o IN
            const placeholders = statusArray.map(() => `$${paramCount++}`).join(',');
            query += ` AND a.status IN (${placeholders})`;
            values.push(...statusArray);
        }
    }
    
    // 3. Filtro por Médico
    if (medico_id) {
        query += ` AND a.medico_id = $${paramCount++}`;
        values.push(medico_id);
    }
    
    // 4. Filtro por Unidade
    if (unidade_id) {
        query += ` AND a.unidade_id = $${paramCount++}`;
        values.push(unidade_id);
    }

    // Ordena pela data oficial do Meet, ou Ativação, ou Preferencial
    query += ` ORDER BY COALESCE(a.data_integracao, a.data_ativacao, a.data_preferencial) ASC`;

    try {
        // O array 'values' é passado para o pool.query para segurança e correta formatação
        const { rows } = await pool.query(query, values);

        return res.status(200).json({
            // Mensagem ajustada para 'agendamentos'
            mensagem: 'Lista de agendamentos carregada com sucesso.',
            agendamentos: rows
        });

    } catch (error) {
        // Log e mensagem de erro ajustados para 'agendamentos'
        logger.error(`Erro ao buscar agendamentos: ${error.message}`, { user_id, error_stack: error.stack, query, values });
        return res.status(500).json({ 
            erro: 'Erro interno ao carregar a lista de agendamentos.' 
        });
    }
};

// =================================================================
// 2. UPDATE (Atualizar Status: Confirmar/Cancelar/Realizado, etc.)
// =================================================================

const updateStatus = async (req, res) => {
    const user_id = req.user.id;
    const { id } = req.params;
    const { status } = req.body; 

    // Adiciona os novos status do ciclo de Ativação
    const validStatuses = [
        'CONFIRMADO', 'CANCELADO', 'PENDENTE', 'AGENDADO', 'REALIZADO', 
        'CONVITE_ENVIADO', 'PRE_AGENDADO', 
        'AGENDAMENTO_ATIVACAO_PENDENTE', 'ATIVACAO_ENVIADA', 'ATIVACAO_PRE_AGENDADA', 
        'ATIVACAO_AGENDADA', 'ATIVACAO_REALIZADA' 
    ]; 
    
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ erro: 'Status inválido.' });
    }

    try {
        const query = `
            UPDATE agendamentos
            SET 
                status = $1,
                data_atualizacao = NOW(),
                atualizado_por = $3
            WHERE id = $2
            RETURNING id, status, medico_id, unidade_id
        `;
        const values = [status, id, user_id];

        const { rows } = await pool.query(query, values);

        if (rows.length === 0) {
            return res.status(404).json({ erro: 'Agendamento de treinamento não encontrado.' });
        }
        
        let additionalData = {};
        const agendamentoAtualizado = rows[0];

        // --- Lógica de Transição de Status ---
        // Se o MEET foi REALIZADO, o sistema transiciona para o novo status de AGENDAMENTO DE ATIVAÇÃO
        if (status === 'REALIZADO') {
            await pool.query(
                `UPDATE agendamentos SET status = 'AGENDAMENTO_ATIVACAO_PENDENTE' WHERE id = $1`,
                [id]
            );
            agendamentoAtualizado.status = 'AGENDAMENTO_ATIVACAO_PENDENTE';
            logger.audit(`Agendamento ID ${id} (Meet Realizado). Transição automática para AGENDAMENTO_ATIVACAO_PENDENTE.`, { user_id, agendamento_id: id });
        }
        // --- Fim da Lógica de Transição ---


        // Busca dados adicionais do médico (Nome e Telefone) para retorno no frontend
        if (status === 'CONVITE_ENVIADO' || status === 'PRE_AGENDADO' || status === 'ATIVACAO_ENVIADA' || status === 'ATIVACAO_PRE_AGENDADA') {
             const medicoQuery = 'SELECT nome, telefone FROM medicos WHERE id = $1';
             const medicoResult = await pool.query(medicoQuery, [agendamentoAtualizado.medico_id]);
             if (medicoResult.rows.length > 0) {
                 additionalData.medico_nome = medicoResult.rows[0].nome;
                 additionalData.medico_telefone = medicoResult.rows[0].telefone;
             }
        }

        logger.audit(`Status do agendamento ID ${id} atualizado para ${status}.`, { user_id, agendamento_id: id, novo_status: status });
        
        return res.status(200).json({ 
            mensagem: `Status do treinamento atualizado para: ${agendamentoAtualizado.status}.`,
            agendamento: { ...agendamentoAtualizado, ...additionalData }
        });

    } catch (error) {
        logger.error(`Erro ao atualizar status do treinamento ID ${id}: ${error.message}`, { user_id, error_stack: error.stack });
        return res.status(500).json({ 
            erro: 'Erro interno ao atualizar o status do treinamento.' 
        });
    }
};


// =================================================================
// 3. CONFIRM (Confirmação por Token - Rota Pública)
// =================================================================

const confirmAgendamentoByToken = async (req, res) => {
    const { token } = req.params; 
    
    if (!token) {
        logger.audit('Tentativa de confirmação sem token.');
        return res.status(400).json({ erro: 'Token de confirmação ausente.' });
    }

    try {
        // Atualiza para 'CONFIRMADO' APENAS se o status atual for 'AGENDADO'
        const query = `
            UPDATE agendamentos
            SET 
                status = 'CONFIRMADO', 
                data_confirmacao = NOW()
            WHERE 
                token_confirmacao = $1 
                AND status = 'AGENDADO' 
            RETURNING id, data_integracao, horario, status, medico_id
        `;
        const values = [token];

        const { rows } = await pool.query(query, values);

        if (rows.length === 0) {
            const checkQuery = `SELECT status FROM agendamentos WHERE token_confirmacao = $1`; 
            const checkResult = await pool.query(checkQuery, [token]);

            if (checkResult.rows.length > 0) {
                 return res.status(409).json({ 
                     erro: `Este agendamento já foi ${checkResult.rows[0].status}.` 
                    });
            }

            return res.status(404).json({ erro: 'Link de confirmação inválido ou expirado.' });
        }
        
        logger.audit(`Agendamento ID ${rows[0].id} confirmado com sucesso via link.`, { medico_id: rows[0].medico_id });
        
        return res.status(200).json({ 
            mensagem: 'Agendamento confirmado com sucesso!',
            agendamento: rows[0]
        });

    } catch (error) {
        logger.error(`Erro ao confirmar agendamento por token: ${error.message}`, { token, error_stack: error.stack });
        return res.status(500).json({ 
            erro: 'Erro interno ao processar a confirmação.' 
        });
    }
};


// =================================================================
// 4. ENDPOINT PÚBLICO: Carregar Detalhes do Convite (MEET)
// Este é o endpoint chamado pela página selecionar-data.html
// =================================================================
const getConviteDetails = async (req, res) => {
    const { id } = req.params;

    try {
        const query = `
            SELECT 
                a.id, 
                a.status,
                a.pals,
                a.acls,
                m.nome AS medico_nome,
                u.nome AS unidade_nome
            FROM agendamentos a
            JOIN medicos m ON a.medico_id = m.id
            JOIN unidades u ON a.unidade_id = u.id
            WHERE a.id = $1 AND a.status IN ('PENDENTE', 'CONVITE_ENVIADO')
        `;
        // Consulta parametrizada com [id] resolve o erro de sintaxe.
        const { rows } = await pool.query(query, [id]);

        if (rows.length === 0) {
            // Log de auditoria se o convite não for encontrado (404)
            logger.audit(`Convite de Integração ID ${id} não encontrado ou expirado.`);
            return res.status(404).json({ erro: 'Convite inválido ou agendamento já finalizado/cancelado.' });
        }

        logger.info(`Detalhes do convite de Integração ID ${id} carregados com sucesso.`);
        return res.status(200).json({
            mensagem: 'Detalhes do convite carregados.',
            agendamento: rows[0]
        });

    } catch (error) {
        // Log de erro 500 com stack trace
        logger.error(`Erro ao buscar detalhes do convite ID ${id}: ${error.message}`, { error_stack: error.stack, query });
        return res.status(500).json({ erro: 'Erro interno ao carregar o convite.' });
    }
};

// =================================================================
// 4B. ENDPOINT PÚBLICO: Carregar Detalhes do Convite de ATIVAÇÃO
// Este é o endpoint chamado pela página selecionar-ativacao.html
// =================================================================
const getAgendamentoAtivacaoPublico = async (req, res) => {
    const { id } = req.params;

    try {
        const query = `
            SELECT 
                a.id, 
                a.status,
                m.nome AS medico_nome,
                u.nome AS unidade_nome
            FROM agendamentos a
            JOIN medicos m ON a.medico_id = m.id
            JOIN unidades u ON a.unidade_id = u.id
            WHERE a.id = $1 
            -- Apenas permite o acesso se estiver no ciclo de ativação
            AND a.status IN ('AGENDAMENTO_ATIVACAO_PENDENTE', 'ATIVACAO_ENVIADA', 'ATIVACAO_PRE_AGENDADA')
        `;
        // Consulta parametrizada com [id]
        const { rows } = await pool.query(query, [id]);

        if (rows.length === 0) {
            logger.audit(`Convite de Ativação ID ${id} não encontrado ou fora do ciclo de seleção.`);
            return res.status(404).json({ erro: 'Convite de Ativação inválido, não encontrado ou agendamento já concluído.' });
        }

        logger.info(`Detalhes públicos de ativação ID ${id} carregados com sucesso.`);
        return res.status(200).json({
            mensagem: 'Detalhes do convite de ativação carregados.',
            medico_nome: rows[0].medico_nome,
            unidade_nome: rows[0].unidade_nome,
            status: rows[0].status
        });

    } catch (error) {
        logger.error(`Erro ao buscar dados públicos de ativação ID ${id}: ${error.message}`, { error_stack: error.stack, query });
        return res.status(500).json({ erro: 'Erro interno ao carregar o convite de ativação.' });
    }
};

// =================================================================
// 5. ENDPOINT PÚBLICO: Receber Seleção de Data do Meet de Integração
// =================================================================
const receberSelecaoMedico = async (req, res) => {
    const agendamentoId = req.params.id; // ID do agendamento (do URL)
    const { 
        data_preferencial, 
        horario_preferencial, 
        status // Espera-se 'PRE_AGENDADO'
    } = req.body;

    // 1. Validação simples
    if (!data_preferencial || !horario_preferencial || status !== 'PRE_AGENDADO') {
        logger.audit(`Tentativa de submissão incompleta para ID ${agendamentoId}.`, req.body);
        return res.status(400).json({ erro: 'Dados de seleção incompletos ou status inválido.' });
    }

    try {
        // 2. Query de Atualização
        const query = `
            UPDATE agendamentos
            SET 
                data_preferencial = $1,
                horario_preferencial = $2,
                status = $3
            WHERE id = $4
            AND status IN ('PENDENTE', 'CONVITE_ENVIADO') -- Garante que apenas agendamentos abertos possam ser atualizados
        `;

        // Os valores são passados como array (consultas parametrizadas)
        const values = [
            data_preferencial,      // $1
            horario_preferencial,   // $2
            status,                 // $3
            agendamentoId           // $4 (Condição WHERE)
        ];
        
        const { rowCount } = await pool.query(query, values);

        if (rowCount === 0) {
            // Se rowCount for 0, o agendamento não existe ou não estava no status correto
            logger.audit(`Agendamento ID ${agendamentoId} não pôde ser atualizado (não encontrado ou status incorreto).`);
            return res.status(404).json({ erro: 'Agendamento não encontrado ou seleção já efetuada.' });
        }
        
        logger.info(`Seleção de data para Agendamento ID ${agendamentoId} registrada com sucesso.`, { data_preferencial, horario_preferencial });
        
        return res.status(200).json({
            mensagem: 'Seleção de data registrada com sucesso. Aguardando confirmação da equipe de Qualidade.'
        });

    } catch (error) {
        logger.error(`Erro ao receber seleção do médico para ID ${agendamentoId}: ${error.message}`, { 
            error_stack: error.stack, 
            query, 
            values 
        });
        return res.status(500).json({ erro: 'Erro interno ao registrar a seleção.' });
    }
};
// =================================================================
// 6. CONFIRMAR AGENDAMENTO FINAL (MEET)
// =================================================================
const confirmarAgendamentoFinal = async (req, res) => {
    
    const user_id = req.user.id;
    const { id } = req.params; 

    if (!id) {
        return res.status(400).json({ erro: 'ID do agendamento é obrigatório.' });
    }

    const token_confirmacao = generateConfirmationToken();

    try {
        const query = `
            UPDATE agendamentos a
            SET 
                data_integracao = a.data_preferencial, 
                horario = a.horario_preferencial, 
                status = 'AGENDADO', 
                token_confirmacao = $1,
                data_atualizacao = NOW(),
                atualizado_por = $2
            FROM medicos m 
            WHERE 
                a.id = $3 
                AND a.status = 'PRE_AGENDADO'
                AND a.medico_id = m.id
            RETURNING 
                a.id, 
                a.medico_id, 
                a.data_integracao, 
                a.horario, 
                a.status, 
                a.token_confirmacao,
                m.nome AS medico_nome, 
                m.telefone AS medico_telefone;
        `;
        const values = [token_confirmacao, user_id, id];

        const { rows } = await pool.query(query, values);

        if (rows.length === 0) {
            return res.status(404).json({ erro: 'Agendamento não encontrado ou não está no status PRE_AGENDADO.' });
        }
        
        const agendamento = rows[0];
        const confirmationLink = `${process.env.APP_BASE_URL}/auth/agendamentos/confirmar/${token_confirmacao}`; 

        logger.audit(`Agendamento ID ${id} confirmado para AGENDADO (usando data preferencial).`, { user_id, agendamento_id: id, novo_status: 'AGENDADO' });

        return res.status(200).json({ 
            mensagem: 'Agendamento finalizado e link de confirmação gerado.', 
            agendamento: agendamento,
            confirmationLink: confirmationLink 
        });

    } catch (error) {
        logger.error(`Erro ao finalizar agendamento do ID ${id}: ${error.message}`, { user_id, error_stack: error.stack });
        return res.status(500).json({ erro: 'Erro interno ao finalizar o agendamento.' });
    }
};


// =================================================================
// 💡 NOVO FLUXO: ATIVAÇÃO ASSISTIDA
// =================================================================

// 7. ENVIAR CONVITE DE ATIVAÇÃO ASSISTIDA (Admin)
const enviarConviteAtivacao = async (req, res) => {
    const user_id = req.user.id;
    const { id } = req.params;

    try {
        // 1. Verifica e Atualiza o status para ATIVACAO_ENVIADA
        const updateQuery = `
            UPDATE agendamentos 
            SET status = 'ATIVACAO_ENVIADA',
                data_atualizacao = NOW(),
                atualizado_por = $2
            WHERE id = $1 AND status = 'AGENDAMENTO_ATIVACAO_PENDENTE'
            RETURNING id, medico_id;
        `;
        const updateResult = await pool.query(updateQuery, [id, user_id]);

        if (updateResult.rows.length === 0) {
            return res.status(404).json({ erro: 'Agendamento não encontrado ou não está no status AGENDAMENTO_ATIVACAO_PENDENTE.' });
        }

        const agendamento = updateResult.rows[0];

        // 2. Busca dados do médico para o link e mensagem
        const medicoQuery = 'SELECT nome, telefone FROM medicos WHERE id = $1';
        const medicoResult = await pool.query(medicoQuery, [agendamento.medico_id]);
        
        if (medicoResult.rows.length === 0) {
            return res.status(404).json({ erro: 'Dados do médico não encontrados.' });
        }
        const medico = medicoResult.rows[0];
        
        // O link de seleção deve apontar para a nova página pública de ativação
        const linkSelecaoAtivacao = `${process.env.APP_BASE_URL}/selecionar-ativacao.html?id=${id}`;

        logger.audit(`Convite de Ativação Assistida enviado para ID ${id}.`, { user_id, agendamento_id: id, novo_status: 'ATIVACAO_ENVIADA' });

        return res.status(200).json({ 
            mensagem: 'Status atualizado para ATIVACAO_ENVIADA. Link gerado para envio via WhatsApp.',
            linkSelecao: linkSelecaoAtivacao,
            medicoNome: medico.nome,
            medicoTelefone: medico.telefone
        });
        
    } catch (error) {
        logger.error(`Erro ao enviar convite de ativação para ID ${id}: ${error.message}`, { user_id, error_stack: error.stack });
        return res.status(500).json({ erro: 'Erro interno ao processar o envio do convite de ativação.' });
    }
};

// =================================================================
// 8. ENDPOINT PÚBLICO: Receber Seleção de Data do Meet de Ativação
// =================================================================
const receberSelecaoAtivacao = async (req, res) => {
    const agendamentoId = req.params.id; // ID do agendamento (do URL)
    // Usando a nomenclatura ajustada para o que o frontend envia
    const { 
        data_preferencial, 
        horario_preferencial, 
        status // Espera-se 'ATIVACAO_PRE_AGENDADA'
    } = req.body;

    // 🛑 CORREÇÃO DE ESCOPO: Declarar query e values fora do try
    let query; 
    let values; 

    // 1. Validação (Validação de tipo 400 - Bad Request)
    if (!data_preferencial || !horario_preferencial || status !== 'ATIVACAO_PRE_AGENDADA') {
        logger.audit(`Tentativa de submissão incompleta ou com status inválido para Ativação ID ${agendamentoId}.`, req.body);
        return res.status(400).json({ erro: 'Dados de seleção incompletos ou status inválido para ativação.' });
    }

    try {
        // 2. Query de Atualização (UTILIZANDO PLACEHOLDERS CORRETOS)
        query = `
            UPDATE agendamentos
            SET 
                data_preferencial = $1,
                horario_preferencial = $2,
                status = $3
            WHERE id = $4
            -- Apenas permite a atualização se o convite foi enviado e ainda não foi pré-agendado.
            AND status = 'ATIVACAO_ENVIADA' 
        `;

        // Os valores são passados como array
        values = [
            data_preferencial,      // $1
            horario_preferencial,   // $2
            status,                 // $3 ('ATIVACAO_PRE_AGENDADA')
            agendamentoId           // $4 (Condição WHERE)
        ];
        
        const { rowCount } = await pool.query(query, values);

        if (rowCount === 0) {
            logger.audit(`Agendamento de Ativação ID ${agendamentoId} não pôde ser atualizado (não encontrado ou fora do ciclo de seleção).`);
            return res.status(404).json({ erro: 'Agendamento de Ativação não encontrado ou seleção já efetuada.' });
        }
        
        logger.info(`Seleção de data para Ativação ID ${agendamentoId} registrada com sucesso.`, { data_preferencial, horario_preferencial });
        
        return res.status(200).json({
            mensagem: 'Seleção de data de Ativação registrada com sucesso. Aguardando confirmação final.'
        });

    } catch (error) {
        // O acesso a query e values agora está seguro
        logger.error(`Erro ao receber seleção de ativação do médico para ID ${agendamentoId}: ${error.message}`, { 
            error_stack: error.stack, 
            query, // Agora acessível
            values // Agora acessível
        });
        return res.status(500).json({ erro: 'Erro interno ao registrar a seleção de ativação.' });
    }
};

// 9. CONFIRMAR AGENDAMENTO DE ATIVAÇÃO FINAL (Admin)
const confirmarAgendamentoAtivacao = async (req, res) => {
    const user_id = req.user.id;
    const { id } = req.params; 

    if (!id) {
        return res.status(400).json({ erro: 'ID do agendamento é obrigatório.' });
    }
    
    try {
        // Pega a data e horário de ativação, transforma o status para ATIVACAO_AGENDADA
        const query = `
            UPDATE agendamentos a
            SET 
                status = 'ATIVACAO_AGENDADA', 
                data_ativacao = a.data_ativacao,
                horario_ativacao = a.horario_ativacao,
                data_atualizacao = NOW(),
                atualizado_por = $1
            FROM medicos m 
            WHERE 
                a.id = $2 
                AND a.status = 'ATIVACAO_PRE_AGENDADA' 
                AND a.medico_id = m.id
            RETURNING 
                a.id, 
                a.medico_id, 
                a.data_ativacao, 
                a.horario_ativacao, 
                a.status,
                m.nome AS medico_nome, 
                m.telefone AS medico_telefone;
        `;
        const values = [user_id, id];

        const { rows } = await pool.query(query, values);

        if (rows.length === 0) {
            return res.status(404).json({ erro: 'Agendamento de ativação não encontrado ou não está no status ATIVACAO_PRE_AGENDADA.' });
        }
        
        const agendamento = rows[0];
        
        const meetAtivacaoLink = 'https://meet.google.com/sua-sala-de-ativacao'; // Placeholder

        logger.audit(`Agendamento de Ativação ID ${id} confirmado para ATIVACAO_AGENDADA.`, { user_id, agendamento_id: id, novo_status: 'ATIVACAO_AGENDADA' });

        return res.status(200).json({ 
            mensagem: 'Agendamento de Ativação finalizado e Meet pronto para envio.', 
            agendamento: agendamento,
            meetAtivacaoLink: meetAtivacaoLink 
        });

    } catch (error) {
        logger.error(`Erro ao finalizar agendamento de ativação do ID ${id}: ${error.message}`, { user_id, error_stack: error.stack });
        return res.status(500).json({ erro: 'Erro interno ao finalizar o agendamento de ativação.' });
    }
};


// =================================================================
// EXPORTS (TODAS AS FUNÇÕES) - ATUALIZADO
// =================================================================

module.exports = {
    createAgendamento,
    getAgendamentos, // <--- CORRIGIDO
    updateStatus,
    confirmAgendamentoByToken,
    // Rotas Públicas (Integração/Meet)
    getConviteDetails, 
    receberSelecaoMedico, 
    // Rota Pública de Ativação (Adicionada na versão anterior)
    getAgendamentoAtivacaoPublico, 
    // Rotas de Admin (Integração/Meet)
    confirmarAgendamentoFinal, 
    
    // NOVO FLUXO: Rotas de Ativação Assistida
    enviarConviteAtivacao,         
    receberSelecaoAtivacao,         
    confirmarAgendamentoAtivacao,   
};