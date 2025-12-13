// src/controllers/medicoController.js

const pool = require('../../db/config'); 
const logger = require('../../log/logger'); 

// =================================================================
// 1. CREATE (Cadastrar Novo Médico) - CORRIGIDO: NOT NULL data_integracao
// =================================================================

const createMedico = async (req, res) => {
    const user_id = req.user.id; 
    
    // CORRETO: Usa 'unidade_id' na desestruturação (conforme o frontend e a coluna correta do BD)
    const { 
        nome, crm, especialidade, unidade_id, 
        porta, emergencia, enfermaria, ambulatorio, uti, 
        data_nasc, rqe, 
        cpf, telefone, email, empresa, observacao,
        pals, acls
    } = req.body; 

    // Validação básica de campos obrigatórios
    if (!nome || !crm || !especialidade || !unidade_id) { 
        logger.audit(`Falha na validação do cadastro de médico. Campos básicos faltando.`, { user_id, body: req.body });
        return res.status(400).json({ erro: 'Os campos básicos (nome, crm, especialidade, unidade_id) são obrigatórios.' }); 
    }

    const client = await pool.connect();
    
    try {
        
        // CHECAGEM DE UNICIDADE REFORÇADA (CRM, CPF, EMAIL)
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
                     client.release();
                     logger.audit(`Falha no cadastro de médico: ${check.field} ${check.value} já existe.`, { user_id });
                     return res.status(409).json({ erro: `O campo ${check.field} ('${check.value}') já está cadastrado no sistema.` });
                }
            }
        }
        
        // INICIA A TRANSAÇÃO E INSERÇÃO DO MÉDICO
        
        await client.query('BEGIN'); 

        // 3. INSERÇÃO DO MÉDICO
        const insertMedicoQuery = `
            INSERT INTO medicos (
                nome, crm, especialidade, unidade_id,
                porta, emergencia, enfermaria, ambulatorio, uti, 
                data_nasc, rqe,
                cpf, telefone, email, empresa, observacao
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING id, nome, crm, especialidade, unidade_id
        `;
        
        const insertMedicoValues = [
            nome, crm, especialidade, unidade_id, 
            !!porta, !!emergencia, !!enfermaria, !!ambulatorio, !!uti,
            data_nasc || null, rqe || null,
            cpf || null, telefone || null, email || null, empresa || null, observacao || null 
        ];

        const { rows } = await client.query(insertMedicoQuery, insertMedicoValues);
        const novoMedico = rows[0];

        // 4. CRIAÇÃO DO AGENDAMENTO INICIAL (PENDENTE)
        // INCLUI data_integracao e horario com valores não-nulos para satisfazer a restrição do BD
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
        if (client) {
            await client.query('ROLLBACK'); 
        }
        
        logger.error(`Erro catastrófico ao cadastrar médico e criar agendamento: ${error.message}`, { user_id, error_stack: error.stack });

        return res.status(500).json({ 
            erro: `Erro interno ao cadastrar. A operação foi cancelada. Detalhe: ${error.message}`
        });
    } finally {
        if (client) {
            client.release(); 
        }
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
                u.nome AS unidade_nome, m.unidade_id
            FROM medicos m
            JOIN unidades u ON m.unidade_id = u.id
            WHERE m.ativo = TRUE
            ORDER BY m.nome
        `);
        logger.audit(`Lista de médicos consultada.`, { user_id, count: result.rows.length });
        return res.json(result.rows);
    } catch (error) {
        logger.error(`Erro ao buscar lista de médicos: ${error.message}`, { user_id, error_stack: error.stack });
        return res.status(500).json({ erro: 'Erro interno ao buscar lista de médicos.' });
    }
};

// =================================================================
// 3. READ (Buscar Médico por ID)
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
                u.nome AS unidade_nome, m.unidade_id
            FROM medicos m
            JOIN unidades u ON m.unidade_id = u.id
            WHERE m.id = $1 AND m.ativo = TRUE
        `, [id]);

        if (result.rows.length === 0) {
            logger.audit(`Tentativa de acesso a médico não encontrado (ID: ${id}).`, { user_id });
            return res.status(404).json({ erro: 'Médico não encontrado.' });
        }

        // Buscando dados de Agendamento (para fins de edição/visualização)
        const agendamentoResult = await pool.query(
            `SELECT pals, acls FROM agendamentos WHERE medico_id = $1 ORDER BY data_criacao DESC LIMIT 1`,
            [id]
        );
        
        const medicoData = result.rows[0];
        
        if (agendamentoResult.rows.length > 0) {
            medicoData.pals = agendamentoResult.rows[0].pals;
            medicoData.acls = agendamentoResult.rows[0].acls;
        } else {
            // Garante que as propriedades existam mesmo sem agendamento
            medicoData.pals = false;
            medicoData.acls = false;
        }


        logger.audit(`Médico consultado (ID: ${id}).`, { user_id });
        return res.json(medicoData);

    } catch (error) {
        logger.error(`Erro ao buscar médico por ID: ${error.message}`, { user_id, error_stack: error.stack });
        return res.status(500).json({ erro: 'Erro interno ao buscar médico.' });
    }
};

// =================================================================
// 4. UPDATE (Atualizar Médico) - CORRIGIDO: NOT NULL data_integracao
// =================================================================
const updateMedico = async (req, res) => {
    const user_id = req.user.id;
    const { id } = req.params;
    
    const { 
        nome, crm, especialidade, unidade_id, 
        porta, emergencia, enfermaria, ambulatorio, uti, 
        data_nasc, rqe, 
        cpf, telefone, email, empresa, observacao, 
        pals, acls // Valores de agendamento (treinamento)
    } = req.body; 

    // Validação básica
    if (!nome || !crm || !especialidade || !unidade_id) { 
        logger.audit(`Falha na validação da atualização do médico ${id}. Campos básicos faltando.`, { user_id, body: req.body });
        return res.status(400).json({ erro: 'Os campos básicos (nome, crm, especialidade, unidade_id) são obrigatórios para atualização.' }); 
    }

    const client = await pool.connect();

    try {
        // 4.1. Checagem de Unicidade (Ignorando o próprio registro)
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
                     client.release(); 
                     logger.audit(`Falha na atualização do médico: ${check.field} ${check.value} já existe para outro registro.`, { user_id, medico_id: id });
                     return res.status(409).json({ erro: `O campo ${check.field} ('${check.value}') já está cadastrado para outro médico.` });
                }
            }
        }
        
        await client.query('BEGIN'); 

        // 4.2. ATUALIZAÇÃO DO MÉDICO
        const updateMedicoQuery = `
            UPDATE medicos SET
                nome = $1, crm = $2, especialidade = $3, unidade_id = $4,
                porta = $5, emergencia = $6, enfermaria = $7, ambulatorio = $8, uti = $9, 
                data_nasc = $10, rqe = $11, 
                cpf = $12, telefone = $13, email = $14, empresa = $15, observacao = $16
            WHERE id = $17 AND ativo = TRUE
            RETURNING id
        `;
        const updateMedicoValues = [
            nome, crm, especialidade, unidade_id, 
            !!porta, !!emergencia, !!enfermaria, !!ambulatorio, !!uti,
            data_nasc || null, rqe || null,
            cpf || null, telefone || null, email || null, empresa || null, observacao || null,
            id
        ];

        const medicoResult = await client.query(updateMedicoQuery, updateMedicoValues);

        if (medicoResult.rows.length === 0) {
            await client.query('ROLLBACK');
            logger.audit(`Tentativa de atualização de médico não encontrado/inativo (ID: ${id}).`, { user_id });
            return res.status(404).json({ erro: 'Médico não encontrado ou inativo.' });
        }
        
        // 4.3. Atualização do Agendamento (pals/acls)
        // Busca o último agendamento (geralmente o PENDENTE ou o mais recente)
        const agendamentoCheck = await client.query(
            `SELECT id FROM agendamentos WHERE medico_id = $1 ORDER BY data_criacao DESC LIMIT 1`,
            [id]
        );
        
        if (agendamentoCheck.rows.length > 0) {
            // Se existir, atualiza o último registro
            await client.query(
                `UPDATE agendamentos SET pals = $1, acls = $2, unidade_id = $4 WHERE id = $3`,
                [!!pals, !!acls, agendamentoCheck.rows[0].id, unidade_id]
            );
        } else {
            // Se não existir (caso improvável após o create), insere um novo registro PENDENTE
             // INCLUI data_integracao e horario com valores não-nulos para satisfazer a restrição do BD
             await client.query(
                 `INSERT INTO agendamentos (medico_id, unidade_id, data_criacao, data_integracao, horario, pals, acls, status) VALUES ($1, $2, NOW(), NOW(), '00:00:00', $3, $4, 'PENDENTE')`,
                 [id, unidade_id, !!pals, !!acls] 
             );
        }

        await client.query('COMMIT'); 
        logger.audit(`Médico (ID: ${id}) atualizado com sucesso.`, { user_id, medico_id: id });
        return res.json({ mensagem: 'Médico e dados de agendamento/treinamento atualizados com sucesso.' });

    } catch (error) {
        if (client) { 
            await client.query('ROLLBACK'); 
        }
        logger.error(`Erro catastrófico ao atualizar médico (ID: ${id}): ${error.message}`, { user_id, error_stack: error.stack });
        return res.status(500).json({ erro: 'Erro interno ao atualizar médico. A operação foi cancelada.' });
    } finally {
        if (client) { 
            client.release();
        }
    }
};


// =================================================================
// 5. DELETE (Inativar/Excluir Médico - Exclusão Lógica)
// =================================================================
const deleteMedico = async (req, res) => {
    const user_id = req.user.id;
    const { id } = req.params;

    try {
        // Exclusão lógica (set ativo = FALSE)
        const result = await pool.query(
            'UPDATE medicos SET ativo = FALSE WHERE id = $1 AND ativo = TRUE RETURNING id',
            [id]
        );

        if (result.rows.length === 0) {
            logger.audit(`Tentativa de inativação de médico não encontrado/já inativo (ID: ${id}).`, { user_id });
            return res.status(404).json({ erro: 'Médico não encontrado ou já inativo.' });
        }

        logger.audit(`Médico (ID: ${id}) inativado (exclusão lógica) com sucesso.`, { user_id });
        return res.json({ mensagem: 'Médico inativado com sucesso.' });

    } catch (error) {
        logger.error(`Erro ao inativar médico (ID: ${id}): ${error.message}`, { user_id, error_stack: error.stack });
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
            WHERE 
                m.ativo = TRUE
                -- O médico DEVE ter um registro PENDENTE
                AND EXISTS (
                    SELECT 1 
                    FROM agendamentos a 
                    WHERE a.medico_id = m.id AND a.status = 'PENDENTE'
                )
                -- E o médico NÃO DEVE ter nenhum registro com status diferente de PENDENTE, 
                -- indicando que o agendamento inicial ainda não foi processado/marcado/realizado.
                AND NOT EXISTS (
                    SELECT 1 
                    FROM agendamentos a 
                    WHERE a.medico_id = m.id AND a.status IN ('AGENDADO', 'REALIZADO', 'CANCELADO', 'CONFIRMADO')
                )
            ORDER BY m.data_cadastro DESC;
        `;
        
        const result = await pool.query(query);
        logger.audit(`Lista de médicos com agendamento PENDENTE consultada.`, { user_id, count: result.rows.length });
        return res.json(result.rows);
        
    } catch (error) {
        logger.error(`Erro ao buscar lista de médicos com agendamento PENDENTE: ${error.message}`, { user_id, error_stack: error.stack });
        return res.status(500).json({ erro: 'Erro interno ao buscar médicos com agendamento PENDENTE.' });
    }
};

// =================================================================
// EXPORTS
// =================================================================

module.exports = {
    createMedico,
    getMedicos,
    getMedicoById,
    updateMedico,
    deleteMedico,
    getMedicosSemAgendamento, 
};