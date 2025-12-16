const pool = require('../../db/config'); 
const logger = require('../../log/logger');
const { v4: uuidv4 } = require('uuid'); 

// =================================================================
// FUNÇÕES AUXILIARES
// =================================================================

/**
 * Gera um token UUID v4 único para confirmação.
 * @returns {string} Token de confirmação.
 */
function generateConfirmationToken() {
    return uuidv4();
}

/**
 * Utilitário para ser chamado pelo MedicoController. Cria um agendamento com status 'PENDENTE'.
 * @param {number} medico_id - ID do médico.
 * @param {number} unidade_id - ID da unidade.
 * @param {boolean} pals - Requer PALS.
 * @param {boolean} acls - Requer ACLS.
 * @param {number} user_id - ID do usuário que criou o agendamento (Admin/Operador).
 * @returns {Promise<object>} O novo registro de agendamento criado.
 */
const createPendingAgendamentoForMedico = async (medico_id, unidade_id, pals, acls, user_id) => {
    const status_agendamento = 'PENDENTE';
    // Data/Horário e Token são nulos para PENDENTE
    const token_confirmacao = null; 

    try {
        const query = `
            INSERT INTO agendamentos (
                medico_id, 
                unidade_id, 
                pals,
                acls,
                status, 
                token_confirmacao,
                criado_por
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, medico_id, status
        `;
        const values = [
            medico_id, 
            unidade_id, 
            pals || false, 
            acls || false,
            status_agendamento, 
            token_confirmacao,
            user_id 
        ];

        const { rows } = await pool.query(query, values);
        return rows[0];

    } catch (error) {
        logger.error(`Erro ao criar agendamento PENDENTE para médico ID ${medico_id}: ${error.message}`, { user_id, error_stack: error.stack });
        // Lança o erro para que o MedicoController possa tratá-lo ou retornar 500
        throw new Error('Erro interno ao registrar agendamento pendente.');
    }
};

// =================================================================
// 0. CREATE (Cadastrar Novo Agendamento Individual) - Status AGENDADO ou PENDENTE
// =================================================================

const createAgendamento = async (req, res) => {
    const user_id = req.user.id;
    const { medico_id, unidade_id, data_integracao, horario, pals, acls } = req.body; 

    if (!medico_id || !unidade_id) {
        return res.status(400).json({ erro: 'ID do médico e ID da unidade são obrigatórios.' });
    }

    // LÓGICA DE STATUS CONDICIONAL: 
    // Se data ou horário forem nulos (ou não fornecidos), o agendamento é PENDENTE.
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
            // Permite NULL para data e horário se for PENDENTE
            data_integracao || null, 
            horario || null, 
            pals || false, 
            acls || false,
            status_agendamento, 
            token_confirmacao,
            user_id // Adiciona quem criou o registro
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
// 1. READ (Listar Agendamentos) - Com filtros
// =================================================================

const getAgendamentos = async (req, res) => {
    const user_id = req.user.id;
    const { data, status, medico_id, unidade_id } = req.query; 

    let query = `
        SELECT 
            a.id, 
            a.data_integracao, 
            a.horario, 
            a.status AS status, 
            a.pals,
            a.acls,
            a.data_preferencial,   -- Data preferencial
            a.horario_preferencial, -- Horário preferencial
            a.criado_em,
            a.data_atualizacao,
            m.nome AS medico_nome, 
            m.crm AS medico_crm, 
            m.telefone AS medico_telefone, 
            u.nome AS unidade_nome
        FROM agendamentos a
        JOIN medicos m ON a.medico_id = m.id
        JOIN unidades u ON a.unidade_id = u.id 
        WHERE 1=1
    `;
    const values = [];
    let paramCount = 1;

    if (data) {
        // Busca por data_integracao (oficial)
        query += ` AND a.data_integracao = $${paramCount++}`;
        values.push(data);
    }
    if (status) {
        query += ` AND a.status = $${paramCount++}`; 
        values.push(status);
    }
    if (medico_id) {
        query += ` AND a.medico_id = $${paramCount++}`;
        values.push(medico_id);
    }
    if (unidade_id) {
        query += ` AND a.unidade_id = $${paramCount++}`;
        values.push(unidade_id);
    }

    // Ordena pela data/horário oficial, priorizando a data oficial sobre a preferencial
    query += ` ORDER BY COALESCE(a.data_integracao, a.data_preferencial) ASC, COALESCE(a.horario, a.horario_preferencial) ASC`;

    try {
        const { rows } = await pool.query(query, values);

        return res.status(200).json({
            mensagem: 'Lista de treinamentos carregada com sucesso.',
            agendamentos: rows
        });

    } catch (error) {
        logger.error(`Erro ao buscar treinamentos: ${error.message}`, { user_id, error_stack: error.stack, query, values });
        return res.status(500).json({ 
            erro: 'Erro interno ao carregar a lista de treinamentos.' 
        });
    }
};

// =================================================================
// 1.1 READ (Buscar Agendamentos PENDENTES) - Rota Específica
// =================================================================

const getAgendamentosPendentes = async (req, res) => {
    const user_id = req.user.id; 

    let query = `
        SELECT 
            a.id, 
            a.data_integracao, 
            a.horario, 
            a.status AS status, 
            a.pals,
            a.acls,
            a.data_preferencial,   
            a.horario_preferencial, 
            a.criado_em,
            m.nome AS medico_nome, 
            m.crm AS medico_crm, 
            u.nome AS unidade_nome
        FROM agendamentos a
        JOIN medicos m ON a.medico_id = m.id
        JOIN unidades u ON a.unidade_id = u.id 
        WHERE a.status IN ('PENDENTE', 'CONVITE_ENVIADO', 'PRE_AGENDADO')
        ORDER BY a.criado_em ASC
    `;

    try {
        const { rows } = await pool.query(query);

        logger.info(`Lista de agendamentos pendentes/em progresso carregada.`, { user_id, count: rows.length });

        return res.status(200).json({
            mensagem: 'Lista de agendamentos pendentes carregada com sucesso.',
            agendamentos: rows
        });

    } catch (error) {
        logger.error(`Erro ao buscar agendamentos PENDENTES: ${error.message}`, { user_id, error_stack: error.stack });
        return res.status(500).json({ 
            erro: 'Erro interno ao carregar a lista de agendamentos pendentes.' 
        });
    }
};

// =================================================================
// 1.2 READ (Buscar Agendamento por ID)
// =================================================================

const getAgendamentoById = async (req, res) => {
    const user_id = req.user.id;
    const { id } = req.params;

    const query = `
        SELECT 
            a.id, 
            a.medico_id,
            a.unidade_id,
            a.data_integracao, 
            a.horario, 
            a.status AS status, 
            a.pals,
            a.acls,
            a.data_preferencial,   
            a.horario_preferencial, 
            a.criado_em,
            a.data_atualizacao,
            m.nome AS medico_nome, 
            m.crm AS medico_crm, 
            u.nome AS unidade_nome
        FROM agendamentos a
        JOIN medicos m ON a.medico_id = m.id
        JOIN unidades u ON a.unidade_id = u.id 
        WHERE a.id = $1
    `;

    try {
        const { rows } = await pool.query(query, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ erro: 'Agendamento não encontrado.' });
        }
        
        logger.info(`Detalhes do agendamento ID ${id} consultados.`, { user_id });
        return res.status(200).json(rows[0]);

    } catch (error) {
        logger.error(`Erro ao buscar agendamento ID ${id}: ${error.message}`, { user_id, error_stack: error.stack });
        return res.status(500).json({ erro: 'Erro interno ao buscar agendamento.' });
    }
};


// =================================================================
// 2. UPDATE (Atualizar Status: Confirmar/Cancelar/Realizado, etc.)
// =================================================================

const updateStatus = async (req, res) => {
    const user_id = req.user.id;
    const { id } = req.params;
    const { status } = req.body; 

    // AJUSTE: Adiciona os novos status para a validação
    const validStatuses = ['CONFIRMADO', 'CANCELADO', 'PENDENTE', 'AGENDADO', 'REALIZADO', 'CONVITE_ENVIADO', 'PRE_AGENDADO']; 
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
        
        // Se o status for 'CONVITE_ENVIADO' ou 'PRE_AGENDADO', retorna dados do médico para o front-end
        let additionalData = {};
        if (status === 'CONVITE_ENVIADO' || status === 'PRE_AGENDADO') {
             // Busca dados adicionais do médico (Nome e Telefone)
            const medicoQuery = 'SELECT nome, telefone FROM medicos WHERE id = $1';
            const medicoResult = await pool.query(medicoQuery, [rows[0].medico_id]);
            if (medicoResult.rows.length > 0) {
                additionalData.medico_nome = medicoResult.rows[0].nome;
                additionalData.medico_telefone = medicoResult.rows[0].telefone;
            }
        }

        logger.audit(`Status do agendamento ID ${id} atualizado para ${status}.`, { user_id, agendamento_id: id, novo_status: status });
        
        return res.status(200).json({ 
            mensagem: `Status do treinamento atualizado para: ${status}.`,
            agendamento: { ...rows[0], ...additionalData }
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
            // Checa se o agendamento existe mas já foi confirmado/cancelado
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
// 4. ENDPOINT PÚBLICO: Carregar Detalhes do Convite
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
        const { rows } = await pool.query(query, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ erro: 'Convite inválido ou agendamento já finalizado/cancelado.' });
        }

        logger.info(`Detalhes do convite ID ${id} carregados. Status: ${rows[0].status}`);

        return res.status(200).json({
            mensagem: 'Detalhes do convite carregados.',
            agendamento: rows[0]
        });

    } catch (error) {
        logger.error(`Erro ao buscar detalhes do convite ID ${id}: ${error.message}`, { error_stack: error.stack });
        return res.status(500).json({ erro: 'Erro interno ao carregar o convite.' });
    }
};


// =================================================================
// 5. ENDPOINT PÚBLICO: Receber Seleção de Data do Médico
// =================================================================
const receberSelecaoMedico = async (req, res) => {
    // Rota pública, não requer autenticação
    const { id } = req.params;
    const { data_preferencial, horario_preferencial } = req.body; 

    if (!id || !data_preferencial || !horario_preferencial) {
        return res.status(400).json({ erro: 'Todos os campos são obrigatórios: ID do agendamento, data e horário preferenciais.' });
    }
    
    // Novo status após a seleção do médico
    const novoStatus = 'PRE_AGENDADO'; 

    try {
        // Atualiza a data/hora preferencial e o status
        const query = `
            UPDATE agendamentos 
            SET status = $1, 
                data_preferencial = $2,
                horario_preferencial = $3,
                data_atualizacao = NOW()
            WHERE id = $4 AND status IN ('PENDENTE', 'CONVITE_ENVIADO') 
            RETURNING id, medico_id, status;
        `;
        
        const { rows } = await pool.query(query, [novoStatus, data_preferencial, horario_preferencial, id]);

        if (rows.length === 0) {
            return res.status(404).json({ erro: 'Agendamento não encontrado ou já foi confirmado/cancelado.' });
        }
        
        logger.audit(`Médico submeteu seleção preferencial para ID ${id}: ${data_preferencial} às ${horario_preferencial}.`, { agendamento_id: id, novo_status: novoStatus, medico_id: rows[0].medico_id });

        return res.status(200).json({ 
            mensagem: 'Seleção de data preferencial registrada com sucesso.'
        });

    } catch (error) {
        logger.error(`Erro ao receber seleção do médico para ID ${id}: ${error.message}`, { error_stack: error.stack });
        return res.status(500).json({ erro: 'Erro interno ao processar a seleção.' });
    }
};

// =================================================================
// 6. CONFIRMAR AGENDAMENTO FINAL (Admin)
// =================================================================
const confirmarAgendamentoFinal = async (req, res) => {
    const user_id = req.user.id;
    // Recebe o ID do agendamento que está PRE_AGENDADO
    const { id } = req.params; 

    if (!id) {
        return res.status(400).json({ erro: 'ID do agendamento é obrigatório.' });
    }

    const token_confirmacao = generateConfirmationToken();

    try {
        // Pega a data e horário preferencial, transforma o status para AGENDADO
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
                AND a.status = 'PRE_AGENDADO' -- APENAS se estiver PRE_AGENDADO
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
        // Gera o link de confirmação usando a variável de ambiente (App Base URL)
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
// EXPORTS (TODAS AS FUNÇÕES)
// =================================================================

module.exports = {
    // CRUD
    createAgendamento,
    getAgendamentos,
    getAgendamentoById, // Adicionado
    updateStatus,
    // Listagem Específica
    getAgendamentosPendentes, // Adicionado
    // Fluxo Público (Médico)
    getConviteDetails, 
    receberSelecaoMedico, 
    // Fluxo de Confirmação Final (Admin)
    confirmarAgendamentoFinal, 
    // Fluxo de Confirmação Externa (Link)
    confirmAgendamentoByToken,
    // Utilitário interno para MedicoController
    createPendingAgendamentoForMedico, // Adicionado
};