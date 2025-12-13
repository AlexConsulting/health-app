// src/controllers/ativacoesSenhaController.js

// 🔴 CAMINHOS CORRIGIDOS (Ajustado para db/config e log/logger)
const pool = require('../../db/config'); 
const logger = require('../../log/logger'); 

const { v4: uuidv4 } = require('uuid'); 
const bcrypt = require('bcryptjs'); 
require('dotenv').config(); // 💡 NECESSÁRIO para acessar PUBLIC_BASE_URL na nova função

// --- FUNÇÕES DE UTILIADADE ---

/**
 * Gera os slots de 15 minutos dentro do intervalo de 14:00 a 16:00.
 * @returns {string[]} Array de horários formatados como 'HH:mm:ss'.
 */
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

// Simulação de Serviço de Mensagens (WhatsApp)
const enviarNotificacaoWhatsApp = (telefone, mensagem) => {
    logger.info(`Notificação WhatsApp ENVIADA para ${telefone}: "${mensagem}"`);
    return true; 
};


// =================================================================
// 1. GERAR JANELAS DISPONÍVEIS (Público/Médico)
// =================================================================

const getJanelasDisponiveis = async (req, res) => {
    const { data } = req.query; 
    const dataBusca = data ? data : new Date().toISOString().split('T')[0]; 
    
    try {
        const ocupadosQuery = `
            SELECT TO_CHAR(horario_agendamento, 'HH24:MI:SS') as horario
            FROM ativacoes_senha
            WHERE data_agendamento = $1
            AND status_meet IN ('AGENDADO', 'CONCLUIDO', 'CREDENCIAIS_ENVIADAS') 
        `;
        const { rows } = await pool.query(ocupadosQuery, [dataBusca]);
        
        const horariosOcupados = new Set(rows.map(row => row.horario));
        const todosSlots = gerarSlotsHorarios();
        const slotsDisponiveis = todosSlots.filter(horario => !horariosOcupados.has(horario));
        
        const janelasFormatadas = slotsDisponiveis.map(horario => ({
            data: dataBusca,
            horario: horario.substring(0, 5) 
        }));

        logger.info(`Janelas disponíveis geradas para ${dataBusca}. Slots encontrados: ${janelasFormatadas.length}`);

        return res.status(200).json({
            dataBusca,
            janelas: janelasFormatadas
        });

    } catch (error) {
        logger.error(`Erro ao buscar janelas disponíveis: ${error.message}`, { error_stack: error.stack });
        return res.status(500).json({ erro: 'Erro interno ao calcular a disponibilidade de horários.' });
    }
};


// =================================================================
// 2. AGENDAR HORÁRIO (Ação do Médico)
// =================================================================

const agendarAtivacaoSenha = async (req, res) => {
    const { medicoId, dataAgendamento, horarioAgendamento, telefoneMedico, crm } = req.body;
    
    if (!medicoId || !dataAgendamento || !horarioAgendamento || !telefoneMedico) {
        return res.status(400).json({ erro: 'Dados obrigatórios (médico, data, horário e telefone) estão faltando.' });
    }

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // GERAÇÃO DE CREDENCIAIS INICIAIS
        const usuarioAcesso = crm || medicoId; 
        const senhaBruta = Math.random().toString(36).slice(-8);
        const senhaHash = await bcrypt.hash(senhaBruta, 10);
        const meetLink = `https://meet.google.com/meet-${uuidv4().substring(0,8)}`; 
        
        // 1. VERIFICAÇÃO FINAL DE DISPONIBILIDADE
        const checkQuery = `
            SELECT id FROM ativacoes_senha
            WHERE data_agendamento = $1 
            AND horario_agendamento = $2
            AND status_meet IN ('AGENDADO', 'CONCLUIDO', 'CREDENCIAIS_ENVIADAS')
        `;
        const { rows: checkRows } = await client.query(checkQuery, [dataAgendamento, horarioAgendamento]);
        
        if (checkRows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ erro: 'Este horário acabou de ser preenchido por outro médico. Escolha outro slot.' });
        }
        
        // 2. INSERE O AGENDAMENTO E AS CREDENCIAIS
        const insertQuery = `
            INSERT INTO ativacoes_senha (
                medico_id, data_agendamento, horario_agendamento, 
                usuario_acesso, senha_hash, meet_link, status_meet
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'AGENDADO')
            RETURNING id
        `;
        const insertValues = [
            medicoId, dataAgendamento, horarioAgendamento, 
            usuarioAcesso, senhaHash, meetLink
        ];
        
        const { rows: insertRows } = await client.query(insertQuery, insertValues);
        
        // 3. NOTIFICAÇÃO 
        const mensagemConfirmacao = `*CONFIRMADO:* Seu agendamento de ativação de senha é no dia ${dataAgendamento} às ${horarioAgendamento}. O link da reunião é: ${meetLink}`;
        enviarNotificacaoWhatsApp(telefoneMedico, mensagemConfirmacao);

        await client.query('COMMIT');

        logger.audit(`Novo agendamento de ativação de senha criado.`, { agendamentoId: insertRows[0].id, medicoId });

        return res.status(201).json({
            mensagem: 'Agendamento confirmado. Você receberá o link do Meet via WhatsApp.',
            agendamentoId: insertRows[0].id
        });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        
        if (error.code === '23505') { 
             return res.status(409).json({ erro: 'Este horário já está agendado. Por favor, escolha outro.' });
        }
        
        logger.error(`Erro ao agendar ativação de senha: ${error.message}`, { medicoId, dataAgendamento, horarioAgendamento, error_stack: error.stack });
        return res.status(500).json({ erro: 'Erro interno no servidor ao agendar.' });
    } finally {
        if (client) client.release();
    }
};

// =================================================================
// 3. OBTEM DADOS DO MÉDICO PELO TOKEN (Para autocaptura)
// =================================================================

const getMedicoDataByToken = async (req, res) => {
    const { token } = req.params;

    if (!token) {
        return res.status(400).json({ erro: 'Token não fornecido.' });
    }

    try {
        // Esta query provavelmente deve buscar um agendamento PENDENTE ou CONVITE_ENVIADO
        // A tabela ativacoes_senha não parece ter um campo 'token_confirmacao' para o fluxo de agendamento inicial
        // Usaremos 'token_confirmacao' como o campo de validação de *ativacao de senha* pós-Meet.
        
        const query = `
            SELECT 
                m.id AS medico_id, 
                m.nome, 
                m.crm, 
                m.telefone,
                a.status_meet
            FROM ativacoes_senha a
            JOIN medicos m ON a.medico_id = m.id
            WHERE a.token_confirmacao = $1 -- Assumindo que o token usado aqui é para o fluxo de ativação de senha
        `;
        const { rows } = await pool.query(query, [token]);

        if (rows.length === 0) {
            return res.status(404).json({ erro: 'Convite inválido ou agendamento não encontrado. Verifique o link.' });
        }

        const medicoData = rows[0];

        // 🚨 ATUALIZAÇÃO DE FLUXO: Se o token for para *ativação* de senha, o status deve ser CREDENCIAIS_ENVIADAS
        if (medicoData.status_meet !== 'CREDENCIAIS_ENVIADAS') {
             return res.status(403).json({ 
                 erro: `Este link não está ativo ou está com status: ${medicoData.status_meet}. Por favor, contate o administrador.`,
                 status: medicoData.status_meet 
             });
        }

        return res.status(200).json({
            medicoId: medicoData.medico_id,
            nome: medicoData.nome,
            crm: medicoData.crm,
            telefone: medicoData.telefone
        });

    } catch (error) {
        logger.error(`Erro ao buscar dados do médico pelo token: ${error.message}`, { token, error_stack: error.stack });
        return res.status(500).json({ erro: 'Erro interno ao validar convite.' });
    }
};


// =================================================================
// 4. LISTAR AGENDAMENTOS (Admin Dashboard - Protegido por JWT)
// =================================================================

const getAgendamentosAdmin = async (req, res) => {
    const { data, status } = req.query;
    
    let query = `
        SELECT 
            a.id, 
            m.nome, 
            m.crm, 
            m.telefone, 
            a.data_agendamento, 
            a.horario_agendamento, 
            a.meet_link,
            a.status_meet,
            a.usuario_acesso, -- 💡 Campo importante para o admin ver
            a.token_confirmacao, -- 💡 Campo importante para o admin ver
            TO_CHAR(a.data_meet_confirmacao, 'DD/MM/YYYY HH24:MI') as data_confirmacao
        FROM ativacoes_senha a
        JOIN medicos m ON a.medico_id = m.id
        WHERE 1=1
    `;
    const params = [];

    if (data) {
        params.push(data);
        query += ` AND a.data_agendamento = $${params.length}`;
    }
    
    // O filtro agora deve incluir o novo status final 'CREDENCIAIS_ENVIADAS'
    const statusFiltro = status ? status.toUpperCase() : 'AGENDADO';
    params.push(statusFiltro);
    query += ` AND a.status_meet = $${params.length}`;

    query += ` ORDER BY a.data_agendamento, a.horario_agendamento`;

    try {
        const { rows } = await pool.query(query, params);
        return res.status(200).json(rows);
    } catch (error) {
        logger.error(`Erro ao listar agendamentos de ativação de senha (Admin): ${error.message}`, { error_stack: error.stack });
        return res.status(500).json({ erro: 'Erro interno ao listar agendamentos.' });
    }
};


// =================================================================
// 5. FINALIZAR MEET (Ação do Admin - Auditoria)
// =================================================================

const finalizarMeet = async (req, res) => {
    const user_id = req.user ? req.user.id : 'ADMIN_TESTE'; 
    const { id } = req.params; 
    const { statusFinal } = req.body; 

    // O status REALIZADO/CONCLUIDO agora é o que habilita o envio de credenciais.
    if (!['CONCLUIDO', 'AUSENTE', 'CANCELADO'].includes(statusFinal)) {
        return res.status(400).json({ erro: 'Status final inválido. Use CONCLUIDO, AUSENTE ou CANCELADO.' });
    }

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // 1. ATUALIZA O STATUS DO MEET E REGISTRA DATA/HORA DA AUDITORIA
        const updateQuery = `
            UPDATE ativacoes_senha 
            SET status_meet = $1, 
                data_meet_confirmacao = NOW()
            WHERE id = $2 AND status_meet = 'AGENDADO'
            RETURNING medico_id, usuario_acesso
        `;
        const { rows } = await client.query(updateQuery, [statusFinal, id]);

        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ erro: 'Agendamento não encontrado, já foi finalizado ou não estava AGENDADO.' });
        }

        const medico = rows[0];

        // 2. OBTEM TELEFONE PARA NOTIFICAÇÃO FINAL
        const { rows: medicoRows } = await client.query('SELECT telefone FROM medicos WHERE id = $1', [medico.medico_id]);
        const telefoneMedico = medicoRows.length > 0 ? medicoRows[0].telefone : null;

        // 3. ENVIO DE NOTIFICAÇÃO FINAL 
        let mensagemFinal;
        if (statusFinal === 'CONCLUIDO') {
            // A notificação de acesso final será tratada pela NOVA função (Seção 6)
            mensagemFinal = `O treinamento foi registrado como *CONCLUÍDO*. Você receberá o link de Ativação de Senha em breve.`; 
        } else if (statusFinal === 'AUSENTE') {
            mensagemFinal = `ATENÇÃO: Foi registrada sua ausência no Meet de Ativação de Senha. Por favor, reagende o horário.`;
        } else { // CANCELADO
             mensagemFinal = `Seu agendamento foi CANCELADO pelo administrador. Por favor, entre em contato para reagendar.`;
        }
        
        if (telefoneMedico) {
            enviarNotificacaoWhatsApp(telefoneMedico, mensagemFinal);
        }

        await client.query('COMMIT');

        logger.audit(`Meet finalizado. Status: ${statusFinal}.`, { user_id, agendamentoId: id, medicoId: medico.medico_id });

        return res.status(200).json({ 
            mensagem: `Status atualizado para ${statusFinal}. Notificação enviada.`
        });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        logger.error(`Erro ao finalizar Meet (Admin): ${error.message}`, { user_id, id, error_stack: error.stack });
        return res.status(500).json({ erro: 'Erro interno ao finalizar o agendamento.' });
    } finally {
        if (client) client.release();
    }
};


// =================================================================
// 💡 6. GERAÇÃO E ENVIO DE CONVITE PARA AGENDAMENTO (Ação do Admin)
// =================================================================

/**
 * [CORRIGIDO] Gera o token de convite de agendamento (token_confirmacao),
 * atualiza o status para CONVITE_ENVIADO e retorna o link de seleção
 * de datas para o Admin enviar via WhatsApp.
 */
const enviarCredenciaisAtivacao = async (req, res) => {
    const { id } = req.params; // ID do Agendamento (Treinamento) na tabela ativacoes_senha
    const user_id = req.user ? req.user.id : 'ADMIN_TESTE'; 

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // 1. Busca dados do médico e verifica status PENDENTE (status inicial para envio do convite)
        const agendamentoDataQuery = `
            SELECT 
                a.medico_id, a.status_meet, m.nome, m.telefone
            FROM ativacoes_senha a
            JOIN medicos m ON a.medico_id = m.id
            WHERE a.id = $1 AND a.status_meet = 'PENDENTE' -- AGORA EXIGE STATUS PENDENTE
            FOR UPDATE
        `;
        const result = await client.query(agendamentoDataQuery, [id]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ erro: 'Agendamento não encontrado ou o status não é PENDENTE para envio do convite.' });
        }
         
        const medicoData = result.rows[0];
         
        // 2. Gera o token único que será usado pelo médico para agendar
        const tokenConvite = uuidv4(); 

        // 3. Atualiza o agendamento (tabela ativacoes_senha) para CONVITE_ENVIADO
        const updateQuery = `
            UPDATE ativacoes_senha 
            SET status_meet = $1, 
                token_confirmacao = $2, 
                data_envio_convite = NOW() -- Usando este campo para rastrear o envio do convite
            WHERE id = $3
            RETURNING *
        `;
        const updateValues = [
            'CONVITE_ENVIADO',  
            tokenConvite,       
            id
        ];
         
        await client.query(updateQuery, updateValues);
         
        await client.query('COMMIT');

        logger.audit(`Convite de agendamento gerado. Status atualizado para CONVITE_ENVIADO.`, { user_id, agendamentoId: id, medicoId: medicoData.medico_id });
         
        // 4. Retorna dados para o frontend montar o link do WhatsApp
        const publicBaseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
        
        // O link aponta para a página pública de seleção de horário, passando o token
        const linkSelecao = `${publicBaseUrl}/ativacao-senha.html?token=${tokenConvite}`;
         
        return res.status(200).json({
            mensagem: 'Convite gerado e status atualizado. WhatsApp pronto para envio.',
            // 🚨 REMOVIDO usuarioAcesso
            linkSelecao,
            medicoNome: medicoData.nome,
            medicoTelefone: medicoData.telefone
        });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        logger.error(`Erro ao gerar convite de agendamento (Admin): ${error.message}`, { user_id, id, error_stack: error.stack });
        return res.status(500).json({ erro: 'Erro interno ao gerar convite.' });
    } finally {
        if (client) client.release();
    }
};


// =================================================================
// EXPORTAÇÃO (Deve estar no final do arquivo)
// =================================================================

module.exports = {
    // Rotas Públicas (Fluxo do Médico)
    getJanelasDisponiveis,
    agendarAtivacaoSenha,
    getMedicoDataByToken, 

    // Rotas Protegidas (Fluxo do Admin)
    getAgendamentosAdmin,
    finalizarMeet,
    
    // 💡 Exporta a função que agora envia o CONVITE DE AGENDAMENTO
    enviarCredenciaisAtivacao 
};