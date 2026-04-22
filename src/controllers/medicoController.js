// src/controllers/medicoController.js

const pool = require('../../db/config'); 
const logger = require('../../log/logger'); 

// Função auxiliar para formatar data para o input date do HTML (YYYY-MM-DD)
const formatarParaInputDate = (data) => {
    if (!data) return "";
    const d = new Date(data);
    return isNaN(d.getTime()) ? "" : d.toISOString().split('T')[0];
};

// =================================================================
// 1. CREATE (Cadastrar Novo Médico) - INTEGRADO COM AGENDAMENTO E N:N
// =================================================================

const createMedico = async (req, res) => {
    const user_id = req.user.id; 
    
    const { 
        nome, crm, especialidade, unidade_id, 
        porta, emergencia, enfermaria, ambulatorio, uti, 
        data_nasc, rqe, 
        cpf, telefone, email, empresa, observacao,
        pals, acls,
        hospitais_ids, 
        data_pals, data_acls, integracao, ativacao_senha 
    } = req.body; 

    if (!nome || !crm || !especialidade || !unidade_id) { 
        logger.audit(`Falha na validação do cadastro de médico. Campos básicos faltando.`, { user_id, body: req.body });
        return res.status(400).json({ erro: 'Os campos básicos (nome, crm, especialidade, unidade_id) são obrigatórios.' }); 
    }

    const client = await pool.connect();
    
    try {
        const checks = [
            { field: 'CRM', value: crm, column: 'crm' },
            { field: 'CPF', value: cpf, column: 'cpf' }, 
            { field: 'Email', value: email, column: 'email' }, 
        ];
        
        for (const check of checks) {
            if (check.value) { 
                const checkQuery = `SELECT id FROM medicos WHERE ${check.column} = $1 AND ativo = TRUE`;
                const result = await client.query(checkQuery, [check.value]);
                
                if (result.rows.length > 0) {
                     logger.audit(`Falha no cadastro de médico: ${check.field} ${check.value} já existe.`, { user_id });
                     return res.status(409).json({ erro: `O campo ${check.field} ('${check.value}') já está cadastrado no sistema.` });
                }
            }
        }
        
        await client.query('BEGIN'); 

        const insertMedicoQuery = `
            INSERT INTO medicos (
                nome, crm, especialidade, unidade_id,
                porta, emergencia, enfermaria, ambulatorio, uti, 
                data_nasc, rqe,
                cpf, telefone, email, empresa, observacao,
                data_pals, data_acls, integracao, ativacao_senha
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
            RETURNING id, nome, crm, especialidade, unidade_id
        `;
        
        const insertMedicoValues = [
            nome, crm, especialidade, unidade_id, 
            !!porta, !!emergencia, !!enfermaria, !!ambulatorio, !!uti,
            data_nasc || null, rqe || null,
            cpf || null, telefone || null, email || null, empresa || null, observacao || null,
            data_pals || null, data_acls || null, !!integracao, !!ativacao_senha
        ];

        const { rows } = await client.query(insertMedicoQuery, insertMedicoValues);
        const novoMedico = rows[0];

        const listaHospitais = Array.isArray(hospitais_ids) && hospitais_ids.length > 0 
            ? hospitais_ids 
            : [unidade_id];

        for (const h_id of listaHospitais) {
            await client.query(
                `INSERT INTO medico_unidades (medico_id, unidade_id) VALUES ($1, $2)`,
                [novoMedico.id, h_id]
            );
        }

        const insertAgendamentoQuery = `
            INSERT INTO agendamentos (
                medico_id, unidade_id, data_criacao, data_integracao, horario, pals, acls, status
            )
            VALUES ($1, $2, NOW(), NOW(), '00:00:00', $3, $4, 'PENDENTE')
            RETURNING id
        `;
        
        const insertAgendamentoValues = [
            novoMedico.id,
            novoMedico.unidade_id, 
            !!pals, 
            !!acls  
        ];

        await client.query(insertAgendamentoQuery, insertAgendamentoValues);

        await client.query('COMMIT'); 

        logger.audit(`Médico ${crm} cadastrado com sucesso e agendamento inicial PENDENTE criado.`, { user_id, medico_id: novoMedico.id });
        return res.status(201).json({ 
            mensagem: 'Médico cadastrado com sucesso. Agendamento inicial (Pendente) criado.',
            medico: novoMedico 
        });

    } catch (error) {
        if (client) await client.query('ROLLBACK'); 
        logger.error(`Erro catastrófico ao cadastrar médico: ${error.message}`, { user_id, error_stack: error.stack });
        if (!res.headersSent) {
            return res.status(500).json({ erro: `Erro interno ao cadastrar. Detalhe: ${error.message}` });
        }
    } finally {
        if (client) client.release();
    }
};

// =================================================================
// 2. READ (Listar Todos os Médicos)
// =================================================================
const getMedicos = async (req, res) => {
    const user_id = req.user.id;
    try {
        const result = await pool.query(`
            SELECT 
                m.id, m.nome, m.crm, m.especialidade, m.cpf, m.telefone, m.email, m.empresa, m.observacao,
                m.porta, m.emergencia, m.enfermaria, m.ambulatorio, m.uti,
                m.data_nasc, m.rqe, m.data_cadastro, m.ativo,
                m.data_pals, m.data_acls, m.integracao, m.ativacao_senha,
                u.nome AS unidade_nome, m.unidade_id
            FROM medicos m
            JOIN unidades u ON m.unidade_id = u.id
            WHERE m.ativo = TRUE
            ORDER BY m.nome
        `);
        
        const formatados = result.rows.map(m => ({
            ...m,
            data_pals: formatarParaInputDate(m.data_pals),
            data_acls: formatarParaInputDate(m.data_acls),
            integracao: !!m.integracao,
            ativacao_senha: !!m.ativacao_senha
        }));

        logger.audit(`Lista de médicos consultada.`, { user_id, count: formatados.length });
        return res.json(formatados);
    } catch (error) {
        logger.error(`Erro ao buscar lista de médicos: ${error.message}`, { user_id, error_stack: error.stack });
        return res.status(500).json({ erro: 'Erro interno ao buscar lista de médicos.' });
    }
};

// =================================================================
// 3. READ (Buscar Médico por ID) - ATUALIZADO
// =================================================================
const getMedicoById = async (req, res) => {
    const user_id = req.user.id;
    const { id } = req.params;

    try {
        const result = await pool.query(`
            SELECT 
                m.id, m.nome, m.crm, m.especialidade, m.cpf, m.telefone, m.email, m.empresa, m.observacao,
                m.porta, m.emergencia, m.enfermaria, m.ambulatorio, m.uti,
                m.data_nasc, m.rqe, m.data_cadastro, m.ativo,
                m.data_pals, m.data_acls, m.integracao, m.ativacao_senha,
                u.nome AS unidade_nome, m.unidade_id
            FROM medicos m
            JOIN unidades u ON m.unidade_id = u.id
            WHERE m.id = $1 AND m.ativo = TRUE
        `, [id]);

        if (result.rows.length === 0) {
            logger.audit(`Tentativa de acesso a médico não encontrado (ID: ${id}).`, { user_id });
            return res.status(404).json({ erro: 'Médico não encontrado.' });
        }

        const medicoData = result.rows[0];

        // Formatação para o Frontend
        medicoData.data_pals = formatarParaInputDate(medicoData.data_pals);
        medicoData.data_acls = formatarParaInputDate(medicoData.data_acls);
        medicoData.integracao = !!medicoData.integracao;
        medicoData.ativacao_senha = !!medicoData.ativacao_senha;

        const agendamentoResult = await pool.query(
            `SELECT pals, acls FROM agendamentos WHERE medico_id = $1 ORDER BY data_criacao DESC LIMIT 1`,
            [id]
        );
        
        medicoData.pals = agendamentoResult.rows[0]?.pals || false;
        medicoData.acls = agendamentoResult.rows[0]?.acls || false;

        let hospitais_ids = [medicoData.unidade_id];
        try {
            const hospitaisRel = await pool.query(
                `SELECT unidade_id FROM medico_unidades WHERE medico_id = $1`, 
                [id]
            );
            if (hospitaisRel.rows.length > 0) {
                hospitais_ids = hospitaisRel.rows.map(r => r.unidade_id);
            }
        } catch (dbErr) {
            logger.warn(`Erro ao carregar hospitais vinculados: ${dbErr.message}`);
        }
        medicoData.hospitais_ids = hospitais_ids;

        logger.audit(`Médico consultado (ID: ${id}).`, { user_id });
        return res.json(medicoData);

    } catch (error) {
        logger.error(`Erro ao buscar médico por ID: ${error.message}`, { user_id, error_stack: error.stack });
        return res.status(500).json({ erro: 'Erro interno ao buscar médico.' });
    }
};

// =================================================================
// 4. UPDATE (Atualizar Médico)
// =================================================================
const updateMedico = async (req, res) => {
    const user_id = req.user.id;
    const { id } = req.params;
    
    const { 
        nome, crm, especialidade, unidade_id, 
        porta, emergencia, enfermaria, ambulatorio, uti, 
        data_nasc, rqe, 
        cpf, telefone, email, empresa, observacao, 
        pals, acls,
        hospitais_ids, 
        enviarParaAgendamento,
        data_pals, data_acls, integracao, ativacao_senha 
    } = req.body; 

    if (!nome || !crm || !especialidade || !unidade_id) { 
        logger.audit(`Falha na validação da atualização do médico ${id}. Campos básicos faltando.`, { user_id, body: req.body });
        return res.status(400).json({ erro: 'Os campos básicos são obrigatórios para atualização.' }); 
    }

    const client = await pool.connect();

    try {
        const checks = [
            { field: 'CRM', value: crm, column: 'crm' },
            { field: 'CPF', value: cpf, column: 'cpf' }, 
            { field: 'Email', value: email, column: 'email' },
        ];
        
        for (const check of checks) {
            if (check.value) { 
                const checkQuery = `SELECT id FROM medicos WHERE ${check.column} = $1 AND id != $2 AND ativo = TRUE`;
                const result = await client.query(checkQuery, [check.value, id]);
                
                if (result.rows.length > 0) {
                     logger.audit(`Falha na atualização: ${check.field} já em uso.`, { user_id, medico_id: id });
                     return res.status(409).json({ erro: `O campo ${check.field} já está cadastrado para outro médico.` });
                }
            }
        }
        
        await client.query('BEGIN'); 

        const updateMedicoQuery = `
            UPDATE medicos SET
                nome = $1, crm = $2, especialidade = $3, unidade_id = $4,
                porta = $5, emergencia = $6, enfermaria = $7, ambulatorio = $8, uti = $9, 
                data_nasc = $10, rqe = $11, 
                cpf = $12, telefone = $13, email = $14, empresa = $15, observacao = $16,
                data_pals = $17, data_acls = $18, integracao = $19, ativacao_senha = $20
            WHERE id = $21 AND ativo = TRUE
            RETURNING id
        `;
        const updateMedicoValues = [
            nome, crm, especialidade, unidade_id, 
            !!porta, !!emergencia, !!enfermaria, !!ambulatorio, !!uti,
            data_nasc || null, rqe || null, 
            cpf || null, telefone || null, email || null, empresa || null, observacao || null,
            data_pals || null, data_acls || null, !!integracao, !!ativacao_senha,
            id
        ];

        const medicoResult = await client.query(updateMedicoQuery, updateMedicoValues);

        if (medicoResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ erro: 'Médico não encontrado.' });
        }

        if (Array.isArray(hospitais_ids)) {
            await client.query(`DELETE FROM medico_unidades WHERE medico_id = $1`, [id]);
            for (const h_id of hospitais_ids) {
                await client.query(
                    `INSERT INTO medico_unidades (medico_id, unidade_id) VALUES ($1, $2)`,
                    [id, h_id]
                );
            }
        }
        
        const agendamentoCheck = await client.query(
            `SELECT id FROM agendamentos WHERE medico_id = $1 ORDER BY data_criacao DESC LIMIT 1`,
            [id]
        );
        
        const statusFinal = enviarParaAgendamento ? 'PENDENTE' : undefined;

        if (agendamentoCheck.rows.length > 0) {
            const queryUpdateAgend = statusFinal 
                ? `UPDATE agendamentos SET pals = $1, acls = $2, unidade_id = $4, status = $5 WHERE id = $3`
                : `UPDATE agendamentos SET pals = $1, acls = $2, unidade_id = $4 WHERE id = $3`;
            
            const valuesUpdateAgend = statusFinal
                ? [!!pals, !!acls, agendamentoCheck.rows[0].id, unidade_id, statusFinal]
                : [!!pals, !!acls, agendamentoCheck.rows[0].id, unidade_id];

            await client.query(queryUpdateAgend, valuesUpdateAgend);
        } else if (enviarParaAgendamento) {
             await client.query(
                 `INSERT INTO agendamentos (medico_id, unidade_id, data_criacao, data_integracao, horario, pals, acls, status) 
                  VALUES ($1, $2, NOW(), NOW(), '00:00:00', $3, $4, 'PENDENTE')`,
                 [id, unidade_id, !!pals, !!acls] 
             );
        }

        await client.query('COMMIT'); 
        logger.audit(`Médico (ID: ${id}) atualizado com sucesso.`, { user_id });
        return res.json({ mensagem: 'Médico e agendamentos atualizados com sucesso.' });

    } catch (error) {
        if (client) await client.query('ROLLBACK'); 
        logger.error(`Erro ao atualizar médico: ${error.message}`, { user_id });
        if (!res.headersSent) return res.status(500).json({ erro: 'Erro interno ao atualizar médico.' });
    } finally {
        if (client) client.release();
    }
};

// =================================================================
// 5. DELETE (Exclusão Lógica)
// =================================================================
const deleteMedico = async (req, res) => {
    const user_id = req.user.id;
    const { id } = req.params;

    try {
        const result = await pool.query(
            'UPDATE medicos SET ativo = FALSE WHERE id = $1 AND ativo = TRUE RETURNING id',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ erro: 'Médico não encontrado ou já inativo.' });
        }

        logger.audit(`Médico (ID: ${id}) inativado.`, { user_id });
        return res.json({ mensagem: 'Médico inativado com sucesso.' });

    } catch (error) {
        logger.error(`Erro ao inativar médico: ${error.message}`, { user_id });
        return res.status(500).json({ erro: 'Erro interno ao inativar médico.' });
    }
};

// =================================================================
// 6. READ (Listar Médicos Com Agendamento PENDENTE)
// =================================================================
const getMedicosSemAgendamento = async (req, res) => {
    const user_id = req.user.id;
    try {
        const query = `
            SELECT 
                m.id, m.nome, m.crm, u.nome AS unidade_nome, m.unidade_id, m.data_cadastro
            FROM 
                medicos m
            JOIN 
                unidades u ON m.unidade_id = u.id
            LEFT JOIN 
                ativacoes_senha ats ON m.id = ats.medico_id
            WHERE 
                m.ativo = TRUE
                AND EXISTS (
                    SELECT 1 
                    FROM agendamentos a 
                    WHERE a.medico_id = m.id AND a.status = 'PENDENTE'
                )
                AND NOT EXISTS (
                    SELECT 1 
                    FROM agendamentos a 
                    WHERE a.medico_id = m.id AND a.status IN ('AGENDADO', 'REALIZADO', 'CANCELADO', 'CONFIRMADO')
                )
                AND (
                    UPPER(u.nome) NOT LIKE '%MBOI%' 
                    OR (UPPER(u.nome) LIKE '%MBOI%' AND ats.status_meet = 'CONCLUIDO')
                )
            ORDER BY m.data_cadastro DESC;
        `;
        
        const result = await pool.query(query);
        logger.audit(`Lista de pendentes consultada.`, { user_id, count: result.rows.length });
        return res.json(result.rows);
        
    } catch (error) {
        logger.error(`Erro ao buscar médicos pendentes: ${error.message}`, { user_id });
        return res.status(500).json({ erro: 'Erro interno ao buscar pendentes.' });
    }
};

// =================================================================
// 7. BUSCAR MÉDICO POR CPF
// =================================================================
const getMedicoByCPF = async (req, res) => {
    const user_id = req.user.id;
    const { cpf } = req.params;
    const cpfSomenteNumeros = cpf.replace(/\D/g, ''); 

    try {
        const query = `
            SELECT 
                m.id, m.nome, m.crm, m.especialidade, m.cpf, m.telefone, m.email, m.empresa, m.observacao,
                m.porta, m.emergencia, m.enfermaria, m.ambulatorio, m.uti,
                m.data_nasc, m.rqe, m.data_cadastro, m.ativo,
                m.data_pals, m.data_acls, m.integracao, m.ativacao_senha,
                u.nome AS unidade_nome, m.unidade_id
            FROM medicos m
            JOIN unidades u ON m.unidade_id = u.id
            WHERE regexp_replace(m.cpf, '[^0-9]', '', 'g') = $1 
              AND m.ativo = TRUE
            LIMIT 1
        `;

        const result = await pool.query(query, [cpfSomenteNumeros]);

        if (result.rows.length === 0) {
            return res.status(404).json({ erro: `Médico não encontrado com o CPF ${cpf}.` });
        }

        const medicoData = result.rows[0];

        // Formatação para o Frontend
        medicoData.data_pals = formatarParaInputDate(medicoData.data_pals);
        medicoData.data_acls = formatarParaInputDate(medicoData.data_acls);
        medicoData.integracao = !!medicoData.integracao;
        medicoData.ativacao_senha = !!medicoData.ativacao_senha;

        const agendamentoResult = await pool.query(
            `SELECT pals, acls FROM agendamentos WHERE medico_id = $1 ORDER BY data_criacao DESC LIMIT 1`,
            [medicoData.id]
        );
        
        medicoData.pals = agendamentoResult.rows[0]?.pals || false;
        medicoData.acls = agendamentoResult.rows[0]?.acls || false;

        let hospitais_ids = [medicoData.unidade_id];
        try {
            const hospitaisRel = await pool.query(
                `SELECT unidade_id FROM medico_unidades WHERE medico_id = $1`, 
                [medicoData.id]
            );
            if (hospitaisRel.rows.length > 0) {
                hospitais_ids = hospitaisRel.rows.map(r => r.unidade_id);
            }
        } catch (e) {}
        medicoData.hospitais_ids = hospitais_ids;

        logger.audit(`Busca por CPF realizada: ${cpfSomenteNumeros}`, { user_id });
        return res.json(medicoData);

    } catch (error) {
        logger.error(`Erro ao buscar médico por CPF: ${error.message}`, { user_id });
        return res.status(500).json({ erro: 'Erro interno na busca por CPF.' });
    }
};

module.exports = {
    createMedico,
    getMedicos,
    getMedicoById,
    updateMedico,
    deleteMedico,
    getMedicosSemAgendamento,
    getMedicoByCPF 
};