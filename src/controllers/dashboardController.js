// src/controllers/dashboardController.js

const pool = require('../../db/config'); 
const logger = require('../../log/logger');
// Adicione outras dependências se necessário (ex: uuid se usar em outras funções)

// =================================================================
// FUNÇÃO: Busca e retorna os 6 KPIs necessários para o Dashboard
// =================================================================

const getKpis = async (req, res) => {
    logger.info(`Usuário ID ${req.user.id} buscando KPIs reais.`);

    try {
        // --- 1. Total de Médicos Ativos (totalMedicos) ---
        const medicosQuery = "SELECT COUNT(*) FROM medicos WHERE ativo = TRUE"; 

        // --- 2. Agendamentos da Semana (agendamentosSemana) ---
        // Conta todos os agendamentos ativos na última semana.
        const agendamentosSemanaQuery = `
            SELECT COUNT(*) AS count FROM agendamentos 
            WHERE data_integracao >= current_date - interval '7 days'
            AND status IN ('AGENDADO', 'CONFIRMADO', 'PRE_AGENDADO', 'ATIVACAO_AGENDADA')`; 
            
        // --- 3. Treinamentos Pré Agendados da Semana (treinamentosPreAgendadosSemana) ---
        // Status: PRE_AGENDADO (médico marcou preferência, aguardando confirmação da equipe)
        const treinamentosPreAgendadosSemanaQuery = `
            SELECT COUNT(*) AS count FROM agendamentos 
            WHERE data_integracao >= current_date - interval '7 days'
            AND status = 'PRE_AGENDADO'`; 
            
        // --- 4. Treinamentos Realizados na Semana (treinamentosRealizadosSemana) ---
        // Status: REALIZADO/CONCLUIDO na última semana.
        const treinamentosRealizadosSemanaQuery = `
            SELECT COUNT(*) AS count FROM agendamentos 
            WHERE status = 'REALIZADO' 
            AND data_integracao >= current_date - interval '7 days'`;
            
        // --- 5. Convites Enviados na Semana (convitesEnviadosSemana) ---
        // Status: ATIVACAO_ENVIADA ou CONVITE_ENVIADO na última semana (baseado na data de criação).
        const convitesEnviadosSemanaQuery = `
            SELECT COUNT(*) AS count FROM agendamentos 
            WHERE data_criacao >= current_date - interval '7 days' 
            AND status IN ('CONVITE_ENVIADO', 'ATIVACAO_ENVIADA')`; 

        // --- 6. Atendimentos/Agendamentos Concluídos no Ano (atendimentosAno) ---
        // Status: REALIZADO no ano atual.
        const atendimentosAnoQuery = `
            SELECT COUNT(*) AS count FROM agendamentos 
            WHERE status = 'REALIZADO' AND data_integracao >= date_trunc('year', current_date)`; 

        // Executa TODAS as 6 consultas em paralelo
        const [
            medicosResult, 
            agendamentosSemanaResult, 
            treinamentosPreAgendadosSemanaResult, 
            treinamentosRealizadosSemanaResult, 
            convitesEnviadosSemanaResult,
            atendimentosAnoResult
        ] = await Promise.all([
            pool.query(medicosQuery),
            pool.query(agendamentosSemanaQuery),
            pool.query(treinamentosPreAgendadosSemanaQuery),
            pool.query(treinamentosRealizadosSemanaQuery),
            pool.query(convitesEnviadosSemanaQuery),
            pool.query(atendimentosAnoQuery),
        ]);
        
        // Extrai e converte os resultados (garantindo que o nome da chave é 'count')
        const totalMedicos = parseInt(medicosResult.rows[0].count) || 0;
        const agendamentosSemana = parseInt(agendamentosSemanaResult.rows[0].count) || 0;
        const treinamentosPreAgendadosSemana = parseInt(treinamentosPreAgendadosSemanaResult.rows[0].count) || 0;
        const treinamentosRealizadosSemana = parseInt(treinamentosRealizadosSemanaResult.rows[0].count) || 0;
        const convitesEnviadosSemana = parseInt(convitesEnviadosSemanaResult.rows[0].count) || 0;
        const atendimentosAno = parseInt(atendimentosAnoResult.rows[0].count) || 0;

        return res.status(200).json({
            // RETORNO FINAL: CHAVES EXATAS que o dashboard.js espera
            totalMedicos,
            agendamentosSemana,
            treinamentosPreAgendadosSemana,
            treinamentosRealizadosSemana,
            convitesEnviadosSemana,
            atendimentosAno
        });

    } catch (error) {
        logger.error(`Erro ao buscar KPIs reais: ${error.message}`, { 
            user_id: req.user.id, 
            error_stack: error.stack 
        });
        return res.status(500).json({ 
            erro: 'Erro interno ao carregar os KPIs. Verifique a existência e estrutura das tabelas (medicos, agendamentos, unidades).' 
        });
    }
};

// =========================================================================
// ROTA PROTEGIDA: Retorna Pendências Operacionais 🎯 FUNÇÃO ADICIONADA
// =========================================================================
const getPendenciasOperacionais = async (req, res) => {
    try {
        // 1. Agendamentos de Integração Pré-Agendados Aguardando Confirmação Final (Admin)
        const aguardandoFinalResult = await pool.query(`
            SELECT COUNT(*) FROM agendamentos
            WHERE status = 'PRE_AGENDADO'
        `);
        const aguardandoFinal = parseInt(aguardandoFinalResult.rows[0].count, 10);

        // 2. Agendamentos de Ativação Pendentes (Convite Enviado, sem seleção de data)
        const ativacaoPendenteResult = await pool.query(`
            SELECT COUNT(*) FROM agendamentos
            WHERE status = 'ATIVACAO_ENVIADA'
        `);
        const ativacaoPendente = parseInt(ativacaoPendenteResult.rows[0].count, 10);

        // 3. Médicos Cadastrados Sem Agendamento Iniciado
        const semAgendamentoResult = await pool.query(`
            SELECT COUNT(m.id)
            FROM medicos m
            LEFT JOIN agendamentos a ON m.id = a.medico_id
            WHERE m.ativo = TRUE AND a.id IS NULL;
        `);
        const semAgendamento = parseInt(semAgendamentoResult.rows[0].count, 10);
        
        // 4. Comunicados Enviados Sem Ciência (Exemplo - Média de ciência abaixo de 50%)
        const comunicadosPendentesResult = await pool.query(`
            SELECT COUNT(c.id)
            FROM comunicados c
            LEFT JOIN (
                SELECT comunicado_id, 
                       CAST(COUNT(id) FILTER (WHERE status_ciente = 'CIENTE') AS DECIMAL) / 
                       NULLIF(CAST(COUNT(id) AS DECIMAL), 0) AS taxa_ciente
                FROM comunicados_medicos
                GROUP BY comunicado_id
            ) AS cm_stats ON c.id = cm_stats.comunicado_id
            WHERE c.data_envio_oficial IS NOT NULL
            AND (cm_stats.taxa_ciente IS NULL OR cm_stats.taxa_ciente < 0.5)
        `);
        const comunicadosBaixaCiencia = parseInt(comunicadosPendentesResult.rows[0].count, 10);


        return res.status(200).json({
            aguardandoConfirmacaoFinal: aguardandoFinal,
            ativacaoPendente: ativacaoPendente,
            semAgendamento: semAgendamento,
            comunicadosBaixaCiencia: comunicadosBaixaCiencia
        });

    } catch (error) {
        logger.error(`Erro ao buscar pendências: ${error.message}`, { error_stack: error.stack });
        return res.status(500).json({ erro: 'Erro interno ao buscar pendências operacionais.' });
    }
};


// =================================================================
// FUNÇÃO: Busca Agendamentos com Filtros (Mantida inalterada)
// =================================================================

const getAgendamentos = async (req, res) => {
    const { date, unitId } = req.query; 
    logger.info(`Usuário ID ${req.user.id} buscando agendamentos reais. Filtros: Data=${date || 'Nenhum'}, Unidade=${unitId || 'Nenhum'}`);

    try {
        let query = `
            SELECT 
                a.id,
                a.paciente_nome, 
                m.nome AS medico_nome,
                m.crm AS medico_crm,
                u.nome AS unidade_nome,
                a.data_integracao,
                a.horario,
                a.status
            FROM agendamentos a
            JOIN medicos m ON a.medico_id = m.id
            JOIN unidades u ON a.unidade_id = u.id
            WHERE 1=1
        `;
        const values = [];
        let paramIndex = 1;

        // 1. Filtro por Unidade
        if (unitId) {
            query += ` AND a.unidade_id = $${paramIndex++}`;
            values.push(unitId);
        }

        // 2. Filtro por Data (se fornecido)
        if (date) {
            query += ` AND a.data_integracao::date = $${paramIndex++}::date`; 
            values.push(date);
        } else {
             // Se nenhuma data for fornecida, mostra a data atual por padrão
             query += ` AND a.data_integracao::date = current_date`; 
        }
        
        // CORRIGIDO: O frontend Dashboard usa o status 'AGENDADO' como filtro padrão.
        // Se a requisição vem do dashboard, é bom ter um filtro de status aqui, 
        // mas vou manter o comportamento original (focado em data)
        
        query += ` ORDER BY a.data_integracao ASC`;
        
        const { rows: agendamentos } = await pool.query(query, values);

        return res.status(200).json({
            mensagem: 'Agendamentos carregados com sucesso.',
            agendamentos: agendamentos 
        });

    } catch (error) {
        logger.error(`Erro ao buscar agendamentos reais: ${error.message}`, { 
            user_id: req.user.id, 
            filters: req.query,
            error_stack: error.stack 
        });
        return res.status(500).json({ 
            erro: 'Erro interno ao carregar agendamentos. Verifique a existência e estrutura das tabelas (agendamentos, medicos, unidades).' 
        });
    }
};

// =================================================================
// EXPORTS (TODAS AS FUNÇÕES) - ATUALIZADO
// =================================================================

module.exports = {
    getKpis,
    getPendenciasOperacionais, // 🎯 FUNÇÃO AGORA EXPORTADA
    getAgendamentos,
};