// src/controllers/dashboardController.js

const pool = require('../../db/config'); 
const logger = require('../../log/logger');

// Função para buscar os KPIs (Key Performance Indicators) com DADOS REAIS
const getKpis = async (req, res) => {
    logger.info(`Usuário ID ${req.user.id} buscando KPIs reais.`);

    try {
        // Consultas SQL para DADOS REAIS
        // KPI 1: Total de Médicos Ativos
        const medicosQuery = "SELECT COUNT(*) FROM medicos WHERE ativo = TRUE"; 
        
        // KPI 2: Agendamentos da Última Semana 
        // CORRIGIDO: Usando tabela 'agendamentos' e coluna 'data_integracao'.
        // Adicionado filtro para status 'AGENDADO' ou 'CONFIRMADO' para evitar contar PENDENTES.
        const agendamentosSemanaQuery = `
            SELECT COUNT(*) FROM agendamentos 
            WHERE data_integracao >= current_date - interval '7 days'
            AND status IN ('AGENDADO', 'CONFIRMADO')`; // <-- CORRIGIDO
            
        // KPI 3: Treinamentos no Mês 
        // CORRIGIDO: Tabela 'agendamentos' e coluna 'data_integracao'. Status final 'REALIZADO'.
        const treinamentosMesQuery = `
            SELECT COUNT(*) FROM agendamentos 
            WHERE status = 'REALIZADO' 
            AND data_integracao >= date_trunc('month', current_date)`; // <-- CORRIGIDO
            
        // KPI 4: Atendimentos/Agendamentos Concluídos no Ano 
        // CORRIGIDO: Status final 'REALIZADO' e coluna 'data_integracao'.
        const atendimentosAnoQuery = `
            SELECT COUNT(*) FROM agendamentos 
            WHERE status = 'REALIZADO' AND data_integracao >= date_trunc('year', current_date)`; // <-- CORRIGIDO

        // Executa todas as consultas em paralelo para maximizar a performance
        const [
            medicosResult, 
            agendamentosSemanaResult, 
            treinamentosMesResult, 
            atendimentosAnoResult
        ] = await Promise.all([
            pool.query(medicosQuery),
            pool.query(agendamentosSemanaQuery),
            pool.query(treinamentosMesQuery),
            pool.query(atendimentosAnoQuery),
        ]);
        
        // Extrai os resultados
        const totalMedicos = parseInt(medicosResult.rows[0].count) || 0;
        const agendamentosSemana = parseInt(agendamentosSemanaResult.rows[0].count) || 0;
        const treinamentosMes = parseInt(treinamentosMesResult.rows[0].count) || 0;
        const atendimentosAno = parseInt(atendimentosAnoResult.rows[0].count) || 0;

        return res.status(200).json({
            totalMedicos,
            agendamentosSemana,
            treinamentosMes,
            atendimentosAno
        });

    } catch (error) {
        logger.error(`Erro ao buscar KPIs reais: ${error.message}`, { 
            user_id: req.user.id, 
            error_stack: error.stack 
        });
        // Mensagem de erro atualizada para refletir as tabelas corretas
        return res.status(500).json({ 
            erro: 'Erro interno ao carregar os KPIs. Verifique a existência e estrutura das tabelas (medicos, agendamentos, unidades).' 
        });
    }
};

// Função para buscar agendamentos reais com filtros (Data e Unidade)
const getAgendamentos = async (req, res) => {
    const { date, unitId } = req.query; 
    logger.info(`Usuário ID ${req.user.id} buscando agendamentos reais. Filtros: Data=${date || 'Nenhum'}, Unidade=${unitId || 'Nenhum'}`);

    try {
        let query = `
            SELECT 
                a.id,
                a.paciente_nome, 
                m.nome AS medico_nome,
                u.nome AS unidade_nome,
                a.data_integracao,
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
            // Assume que o date está no formato YYYY-MM-DD para comparação com data_integracao
            query += ` AND a.data_integracao::date = $${paramIndex++}::date`; 
            values.push(date);
        } else {
             // Se nenhuma data for fornecida, mostra a data atual por padrão
             query += ` AND a.data_integracao::date = current_date`; 
        }

        query += ` ORDER BY a.data_integracao ASC`;
        
        const { rows: agendamentos } = await pool.query(query, values);

        return res.status(200).json({
            mensagem: 'Agendamentos carregados com sucesso.',
            agendamentos: agendamentos 
        });

    } catch (error) {
        // CORRIGIDO: Mensagem de log atualizada para 'agendamentos reais' (antes era 'agendamentos')
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

module.exports = {
    getKpis,
    getAgendamentos,
};