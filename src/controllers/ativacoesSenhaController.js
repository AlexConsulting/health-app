// src/controllers/ativacoesSenhaController.js

const pool = require('../../db/config'); 
const logger = require('../../log/logger'); 

const { v4: uuidv4 } = require('uuid'); 
const bcrypt = require('bcryptjs'); 
require('dotenv').config();

// --- FUNÇÕES DE UTILIDADE ---

function gerarSlotsHorarios() {
    const slots = [];
    const inicioMinutos = 14 * 60; 
    const fimMinutos = 16 * 60;
    
    for (let minutos = inicioMinutos; minutos < fimMinutos; minutos += 15) {
        const horas = Math.floor(minutos / 60);
        const min = minutos % 60;
        const horarioFormatado = `${String(horas).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
        slots.push(horarioFormatado);
    }
    return slots;
}

// =================================================================
// 1. BUSCAR DISPONIBILIDADE (Ação do Médico)
// =================================================================
const getJanelasDisponiveis = async (req, res) => {
    const { data } = req.query; 
    const dataBusca = data ? data : new Date().toISOString().split('T')[0]; 
    
    try {
        const ocupadosQuery = `
            SELECT TO_CHAR(horario_agendamento, 'HH24:MI:SS') as horario
            FROM ativacoes_senha
            WHERE data_agendamento = $1
            AND status_meet IN ('AGENDADO', 'CONCLUIDO') 
        `;
        const { rows } = await pool.query(ocupadosQuery, [dataBusca]);
        
        const horariosOcupados = new Set(rows.map(row => row.horario));
        const todosSlots = gerarSlotsHorarios();
        const slotsDisponiveis = todosSlots.filter(horario => !horariosOcupados.has(horario));
        
        const janelasFormatadas = slotsDisponiveis.map(horario => ({
            data: dataBusca,
            horario: horario.substring(0, 5) 
        }));

        return res.status(200).json({ dataBusca, janelas: janelasFormatadas });
    } catch (error) {
        logger.error(`Erro ao buscar janelas: ${error.message}`);
        return res.status(500).json({ erro: 'Erro ao calcular disponibilidade.' });
    }
};

// =================================================================
// 2. CONFIRMAR AGENDAMENTO (Ação do Médico via Botão)
// =================================================================
const agendarAtivacaoSenha = async (req, res) => {
    const { token, data_agendamento, horario_agendamento } = req.body;
    
    if (!token || !data_agendamento || !horario_agendamento) {
        return res.status(400).json({ erro: 'Dados de agendamento incompletos.' });
    }

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const checkQuery = `
            SELECT id FROM ativacoes_senha
            WHERE data_agendamento = $1 AND horario_agendamento = $2
            AND status_meet IN ('AGENDADO', 'CONCLUIDO')
        `;
        const { rows: checkRows } = await client.query(checkQuery, [data_agendamento, horario_agendamento]);
        
        if (checkRows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ erro: 'Este horário acabou de ser preenchido por outro usuário.' });
        }

        const meetLink = `https://meet.google.com/meet-${uuidv4().substring(0,8)}`; 
        
        const updateQuery = `
            UPDATE ativacoes_senha SET
                data_agendamento = $1, 
                horario_agendamento = $2, 
                meet_link = $3, 
                status_meet = 'AGENDADO'
            WHERE token_confirmacao = $4
            RETURNING id, medico_id
        `;
        const { rows: updateRows } = await client.query(updateQuery, [
            data_agendamento, horario_agendamento, meetLink, token
        ]);
        
        if (updateRows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ erro: 'Convite não encontrado ou já expirado.' });
        }

        await client.query('COMMIT');
        logger.info(`Agendamento realizado para medico_id: ${updateRows[0].medico_id}`);
        return res.status(200).json({ mensagem: 'Agendamento confirmado!' });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        logger.error(`Erro ao confirmar agendamento: ${error.message}`);
        return res.status(500).json({ erro: 'Erro interno ao processar agendamento.' });
    } finally {
        if (client) client.release();
    }
};

// =================================================================
// 3. OBTEM DADOS DO MÉDICO PELO TOKEN (Público)
// =================================================================
const getMedicoDataByToken = async (req, res) => {
    const { token } = req.params;
    try {
        const query = `
            SELECT m.nome as medico_nome, u.nome as unidade_nome 
            FROM ativacoes_senha a
            JOIN medicos m ON a.medico_id = m.id
            JOIN unidades u ON m.unidade_id = u.id
            WHERE a.token_confirmacao = $1
        `;
        const { rows } = await pool.query(query, [token]);
        if (rows.length === 0) return res.status(404).json({ erro: 'Link inválido.' });

        return res.status(200).json(rows[0]);
    } catch (error) {
        logger.error(`Erro ao buscar dados pelo token: ${error.message}`);
        return res.status(500).json({ erro: 'Erro na validação do link.' });
    }
};

// =================================================================
// 4. LISTAR AGENDAMENTOS (Admin)
// =================================================================
const getAgendamentosAdmin = async (req, res) => {
    const { status } = req.query;
    const DATA_CORTE = '2026-03-05 00:00:00';

    let query = `
        SELECT 
            m.id AS medico_id, m.nome AS medico_nome, u.nome AS unidade_nome,
            COALESCE(a.status_meet::text, 'PENDENTE') AS status,
            a.id AS ativacao_id, a.data_agendamento, a.horario_agendamento, 
            a.meet_link, a.usuario_acesso
        FROM medicos m
        LEFT JOIN unidades u ON m.unidade_id = u.id
        LEFT JOIN ativacoes_senha a ON m.id = a.medico_id
        WHERE m.data_cadastro >= $1
        AND UPPER(u.nome) LIKE '%MBOI%'
    `;
    const params = [DATA_CORTE];

    if (status) {
        params.push(status.toUpperCase());
        query += ` AND a.status_meet = $2`;
    }

    query += ` ORDER BY a.data_agendamento ASC, a.horario_agendamento ASC`;

    try {
        const { rows } = await pool.query(query, params);
        return res.status(200).json(rows);
    } catch (error) {
        logger.error(`Erro Admin ao listar: ${error.message}`);
        return res.status(500).json({ erro: 'Erro ao listar registros.' });
    }
};

// =================================================================
// 5. GERAR CONVITE (Ação do Botão no Dashboard Admin)
// =================================================================
const enviarCredenciaisAtivacao = async (req, res) => {
    const { id } = req.params; 
    const tokenConvite = uuidv4(); 

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const medicoRes = await client.query(`
            SELECT m.nome, m.telefone, u.nome as unidade_nome 
            FROM medicos m 
            JOIN unidades u ON m.unidade_id = u.id 
            WHERE m.id = $1
        `, [id]);

        if (medicoRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ erro: 'Médico não encontrado.' });
        }

        const medico = medicoRes.rows[0];

        if (!medico.unidade_nome.toUpperCase().includes('MBOI')) {
            await client.query('ROLLBACK');
            return res.status(400).json({ erro: 'Ativação via call restrita ao Hospital Mboi.' });
        }

        const upsertQuery = `
            INSERT INTO ativacoes_senha (medico_id, token_confirmacao, status_meet, data_envio_convite)
            VALUES ($1, $2, 'CONVITE_ENVIADO', NOW())
            ON CONFLICT (medico_id) 
            DO UPDATE SET 
                token_confirmacao = EXCLUDED.token_confirmacao,
                status_meet = 'CONVITE_ENVIADO',
                data_envio_convite = NOW()
            RETURNING id;
        `;
        await client.query(upsertQuery, [id, tokenConvite]);
        await client.query('COMMIT');

        const publicBaseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
        const linkSelecao = `${publicBaseUrl}/agendamento-medico.html?token=${tokenConvite}`;
          
        return res.status(200).json({
            mensagem: 'Convite preparado!',
            linkSelecao,
            medicoNome: medico.nome,
            medicoTelefone: medico.telefone
        });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        logger.error(`Erro ao gerar convite: ${error.message}`);
        return res.status(500).json({ erro: 'Erro ao processar ativação.' });
    } finally {
        if (client) client.release();
    }
};

// =================================================================
// 6. FINALIZAR MEET (Ação do Admin ao concluir a Call)
// =================================================================
const finalizarMeet = async (req, res) => {
    const { id } = req.params; // ID da ativacao_senha
    const { status, usuario_acesso } = req.body; // CONCLUIDO, AUSENTE, CANCELADO

    if (!['CONCLUIDO', 'AUSENTE', 'CANCELADO'].includes(status)) {
        return res.status(400).json({ erro: 'Status de finalização inválido.' });
    }

    try {
        const query = `
            UPDATE ativacoes_senha 
            SET status_meet = $1, 
                usuario_acesso = $2,
                data_finalizacao = NOW()
            WHERE id = $3
            RETURNING id, medico_id
        `;
        const { rows } = await pool.query(query, [status, usuario_acesso || null, id]);

        if (rows.length === 0) {
            return res.status(404).json({ erro: 'Registro de ativação não encontrado.' });
        }

        logger.info(`Meet finalizado com status ${status} para ativação ID ${id}`);
        return res.status(200).json({ mensagem: `Ativação marcada como ${status}.` });
    } catch (error) {
        logger.error(`Erro ao finalizar meet: ${error.message}`);
        return res.status(500).json({ erro: 'Erro interno ao finalizar ativação.' });
    }
};

// EXPORTS
module.exports = {
    getJanelasDisponiveis,
    agendarAtivacaoSenha,
    getMedicoDataByToken,
    getAgendamentosAdmin,      
    enviarCredenciaisAtivacao, 
    finalizarMeet              
};