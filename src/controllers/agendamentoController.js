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
                criado_por,
                tipo_servico -- 💡 DIFERENCIAL: Define como Treinamento
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'TREINAMENTO')
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

        logger.audit(`Agendamento (Treinamento) criado para o médico ID ${medico_id}.`, { user_id, agendamento_id: novoAgendamento.id });
        
        return res.status(201).json({ 
            mensagem: `Agendamento de treinamento criado com sucesso.`, 
            agendamento: novoAgendamento 
        });

    } catch (error) {
        logger.error(`Erro ao criar agendamento: ${error.message}`, { user_id, error_stack: error.stack });
        return res.status(500).json({ erro: 'Erro interno ao registrar o agendamento.' });
    }
};

// =================================================================
// 1. READ (Listar Agendamentos) - FILTRADO POR TREINAMENTO
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
            a.data_preferencial,
            a.horario_preferencial,
            m.nome AS medico_nome, 
            m.crm AS medico_crm, 
            m.telefone AS medico_telefone, 
            u.nome AS unidade_nome
        FROM agendamentos a
        JOIN medicos m ON a.medico_id = m.id
        JOIN unidades u ON a.unidade_id = u.id 
        WHERE a.tipo_servico = 'TREINAMENTO' -- 💡 FILTRO: Não traz Ativação de Senha
    `;
    const values = [];
    let paramCount = 1;

    if (data) {
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

    query += ` ORDER BY COALESCE(a.data_integracao, a.data_preferencial) ASC, COALESCE(a.horario, a.horario_preferencial) ASC`;

    try {
        const { rows } = await pool.query(query, values);
        return res.status(200).json({
            mensagem: 'Lista de treinamentos carregada.',
            agendamentos: rows
        });
    } catch (error) {
        logger.error(`Erro ao buscar treinamentos: ${error.message}`, { user_id });
        return res.status(500).json({ erro: 'Erro interno ao carregar treinamentos.' });
    }
};

// =================================================================
// 2. UPDATE (Atualizar Status)
// =================================================================

const updateStatus = async (req, res) => {
    const user_id = req.user.id;
    const { id } = req.params;
    const { status } = req.body; 

    const validStatuses = ['CONFIRMADO', 'CANCELADO', 'PENDENTE', 'AGENDADO', 'REALIZADO', 'CONVITE_ENVIADO', 'PRE_AGENDADO']; 
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ erro: 'Status inválido.' });
    }

    try {
        const query = `
            UPDATE agendamentos
            SET status = $1, data_atualizacao = NOW(), atualizado_por = $3
            WHERE id = $2 AND tipo_servico = 'TREINAMENTO'
            RETURNING id, status, medico_id, unidade_id
        `;
        const { rows } = await pool.query(query, [status, id, user_id]);

        if (rows.length === 0) {
            return res.status(404).json({ erro: 'Treinamento não encontrado.' });
        }
        
        let additionalData = {};
        if (status === 'CONVITE_ENVIADO' || status === 'PRE_AGENDADO') {
            const medicoResult = await pool.query('SELECT nome, telefone FROM medicos WHERE id = $1', [rows[0].medico_id]);
            if (medicoResult.rows.length > 0) {
                additionalData.medico_nome = medicoResult.rows[0].nome;
                additionalData.medico_telefone = medicoResult.rows[0].telefone;
            }
        }

        logger.audit(`Status do treinamento ID ${id} atualizado para ${status}.`, { user_id, agendamento_id: id });
        return res.status(200).json({ 
            mensagem: `Status atualizado.`,
            agendamento: { ...rows[0], ...additionalData }
        });

    } catch (error) {
        logger.error(`Erro ao atualizar status: ${error.message}`);
        return res.status(500).json({ erro: 'Erro interno.' });
    }
};


// =================================================================
// 3. CONFIRM (Confirmação por Token - Rota Pública)
// =================================================================

const confirmAgendamentoByToken = async (req, res) => {
    const { token } = req.params; 

    if (!token) return res.status(400).json({ erro: 'Token ausente.' });

    try {
        const query = `
            UPDATE agendamentos
            SET status = 'CONFIRMADO', data_confirmacao = NOW()
            WHERE token_confirmacao = $1 AND status = 'AGENDADO' AND tipo_servico = 'TREINAMENTO'
            RETURNING id, data_integracao, horario, status, medico_id
        `;
        const { rows } = await pool.query(query, [token]);

        if (rows.length === 0) {
            return res.status(404).json({ erro: 'Link inválido ou já processado.' });
        }
        
        return res.status(200).json({ mensagem: 'Confirmado!', agendamento: rows[0] });
    } catch (error) {
        return res.status(500).json({ erro: 'Erro interno.' });
    }
};


// =================================================================
// 4. ENDPOINT PÚBLICO: Detalhes do Convite
// =================================================================
const getConviteDetails = async (req, res) => {
    const { id } = req.params;

    try {
        const query = `
            SELECT a.id, a.status, a.pals, a.acls, m.nome AS medico_nome, u.nome AS unidade_nome, a.unidade_id 
            FROM agendamentos a
            JOIN medicos m ON a.medico_id = m.id
            JOIN unidades u ON a.unidade_id = u.id
            WHERE a.id = $1 AND a.status IN ('PENDENTE', 'CONVITE_ENVIADO') AND a.tipo_servico = 'TREINAMENTO'
        `;
        const { rows } = await pool.query(query, [id]);

        if (rows.length === 0) return res.status(404).json({ erro: 'Convite inválido.' });

        return res.status(200).json({ agendamento: rows[0] });
    } catch (error) {
        return res.status(500).json({ erro: 'Erro ao carregar convite.' });
    }
};


// =================================================================
// 5. CONSULTAR DISPONIBILIDADE (Isolada de Ativação de Senha)
// =================================================================
const getDisponibilidade = async (req, res) => {
    const { data, unidade_id } = req.query;

    if (!data || !unidade_id) return res.status(400).json({ erro: 'Data e Unidade obrigatórias.' });

    try {
        // 💡 REGRA: Só conta como ocupado se houver outro TREINAMENTO.
        // Ativações de senha não bloqueiam a agenda de treinamentos.
        const queryConflitos = `
            SELECT horario, horario_preferencial, unidade_id
            FROM agendamentos 
            WHERE 
                (DATE(data_integracao) = $1 OR DATE(data_preferencial) = $1)
                AND status IN ('AGENDADO', 'CONFIRMADO', 'PRE_AGENDADO')
                AND tipo_servico = 'TREINAMENTO'
        `;
        
        const { rows } = await pool.query(queryConflitos, [data]);
        return res.status(200).json(rows);
    } catch (error) {
        return res.status(500).json({ erro: 'Erro ao consultar horários.' });
    }
};


// =================================================================
// 6. ENDPOINT PÚBLICO: Receber Seleção do Médico
// =================================================================
const receberSelecaoMedico = async (req, res) => {
    const { id } = req.params;
    const { data_preferencial, horario_preferencial } = req.body; 

    if (!id || !data_preferencial || !horario_preferencial) return res.status(400).json({ erro: 'Dados incompletos.' });
    
    try {
        const query = `
            UPDATE agendamentos 
            SET status = 'PRE_AGENDADO', data_integracao = $2, horario = $3, 
                data_preferencial = $2, horario_preferencial = $3, data_atualizacao = NOW()
            WHERE id = $4 AND status IN ('PENDENTE', 'CONVITE_ENVIADO') AND tipo_servico = 'TREINAMENTO'
            RETURNING id, status;
        `;
        const { rows } = await pool.query(query, ['PRE_AGENDADO', data_preferencial, horario_preferencial, id]);

        if (rows.length === 0) return res.status(404).json({ erro: 'Não permitido.' });

        return res.status(200).json({ mensagem: 'Pré-agendado com sucesso!' });
    } catch (error) {
        return res.status(500).json({ erro: 'Erro ao processar seleção.' });
    }
};

// =================================================================
// 7. CONFIRMAR AGENDAMENTO FINAL (Admin)
// =================================================================
const confirmarAgendamentoFinal = async (req, res) => {
    const user_id = req.user.id;
    const { id } = req.params; 

    const token_confirmacao = generateConfirmationToken();

    try {
        const query = `
            UPDATE agendamentos a
            SET data_integracao = a.data_preferencial, horario = a.horario_preferencial, 
                status = 'AGENDADO', token_confirmacao = $1, data_atualizacao = NOW(), atualizado_por = $2
            FROM medicos m 
            WHERE a.id = $3 AND a.status = 'PRE_AGENDADO' AND a.tipo_servico = 'TREINAMENTO' AND a.medico_id = m.id
            RETURNING a.id, a.medico_id, a.data_integracao, a.horario, a.status, a.token_confirmacao, m.nome AS medico_nome, m.telefone AS medico_telefone;
        `;
        const { rows } = await pool.query(query, [token_confirmacao, user_id, id]);

        if (rows.length === 0) return res.status(404).json({ erro: 'Treinamento não está em fase de confirmação.' });
        
        const confirmationLink = `${process.env.APP_BASE_URL}/auth/agendamentos/confirmar/${token_confirmacao}`; 

        return res.status(200).json({ 
            mensagem: 'Confirmado com sucesso.', 
            agendamento: rows[0],
            confirmationLink: confirmationLink 
        });
    } catch (error) {
        return res.status(500).json({ erro: 'Erro ao finalizar.' });
    }
};

module.exports = {
    createAgendamento,
    getAgendamentos,
    updateStatus,
    confirmAgendamentoByToken,
    getConviteDetails,
    getDisponibilidade,
    receberSelecaoMedico,
    confirmarAgendamentoFinal, 
};