// public/js/dashboard.js

const welcomeMessage = document.getElementById('welcome-message');
const currentDateTimeElement = document.getElementById('current-datetime');
const logoutButton = document.getElementById('logout-button');
const appointmentList = document.getElementById('agendamentos-list');
const pendenciasList = document.getElementById('pendencias-list'); 

// Função para atualizar data e hora
function updateDateTime() {
    const now = new Date();
    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit' };
    
    const date = now.toLocaleDateString('pt-BR', dateOptions);
    const time = now.toLocaleTimeString('pt-BR', timeOptions);
    
    currentDateTimeElement.textContent = `${date} | ${time}`;
}

// =========================================================================
// FUNÇÕES DE REQUISIÇÃO E AUTENTICAÇÃO
// =========================================================================

// Função para fazer requisição autenticada (Obrigatório o token JWT)
async function fetchAuthenticatedData(endpoint, token) {
    const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`, // ENVIANDO O TOKEN JWT!
            'Content-Type': 'application/json'
        }
    });

    if (response.status === 401) {
        // Se a API retornar 401 (Não Autorizado), força o logout
        localStorage.removeItem('userToken');
        localStorage.removeItem('userName');
        alert('Sessão inválida ou expirada. Faça o login novamente.');
        window.location.href = '/login.html';
        return null;
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ erro: 'Erro desconhecido.' }));
        console.error(`Erro ao buscar ${endpoint}:`, errorData);
        return null;
    }

    return response.json();
}

// =========================================================================
// LÓGICA DE CARREGAMENTO DE DADOS E RENDERIZAÇÃO
// =========================================================================

// Função para buscar e renderizar as unidades no filtro
async function loadUnits(token) {
    const unitSelect = document.getElementById('appointment-unit');
    while (unitSelect.options.length > 1) {
        unitSelect.remove(1);
    }
    
    const data = await fetchAuthenticatedData('/api/unidades', token); 

    if (data && data.unidades && data.unidades.length > 0) {
        data.unidades.forEach(unit => {
            const option = document.createElement('option');
            option.value = unit.id; 
            option.textContent = unit.nome;
            unitSelect.appendChild(option);
        });
    } else {
        const option = document.createElement('option');
        option.value = ""; 
        option.textContent = "Nenhuma unidade cadastrada";
        unitSelect.appendChild(option);
        unitSelect.disabled = true;
    }
}

/**
 * 🎯 CORREÇÃO: Atualizada para refletir os 6 novos IDs de cards KPI no dashboard.html.
 */
function renderKpis(data) {
    document.getElementById('total-medicos').textContent = data.totalMedicos || '0';
    document.getElementById('agendamentos-semana').textContent = data.agendamentosSemana || '0';
    
    // IDs DE KPI NOVOS/ATUALIZADOS
    document.getElementById('treinamentos-pre-agendados-semana').textContent = data.treinamentosPreAgendadosSemana || '0';
    document.getElementById('treinamentos-realizados-semana').textContent = data.treinamentosRealizadosSemana || '0';
    document.getElementById('convites-enviados-semana').textContent = data.convitesEnviadosSemana || '0';
    
    document.getElementById('atendimentos-ano').textContent = data.atendimentosAno || '0';
}

async function loadKpis(token) {
    // Endpoint /api/dashboard/kpis no backend precisa retornar as 6 novas métricas (totalMedicos, agendamentosSemana, etc.)
    const data = await fetchAuthenticatedData('/api/dashboard/kpis', token); 
    if (data) {
        renderKpis(data);
    } else {
        renderKpis({}); 
    }
}

/**
 * 🎯 CORREÇÃO: Remoção total da lógica de buscar e exibir "Agendamentos Pendentes (Lote)".
 * Mantém apenas o item "Termos não lidos" (simulado).
 */
async function loadOperationalPendencies(token) {
    if (!token) return;

    pendenciasList.innerHTML = ''; // Limpa a lista.
    
    try {
        // Adiciona o item Termos não lidos (simulado)
        const itemTermos = document.createElement('li');
        itemTermos.innerHTML = 'Termos não lidos: <span>5</span>'; 
        pendenciasList.appendChild(itemTermos);
        
    } catch (error) {
        console.error('Erro ao carregar pendências operacionais:', error);
        pendenciasList.innerHTML = `
            <li>Falha ao carregar Pendentes</li>
        `;
    }
}


function renderAppointments(agendamentos) {
    appointmentList.innerHTML = ''; 

    if (!agendamentos || agendamentos.length === 0) {
        appointmentList.innerHTML = '<p class="placeholder-text">Nenhum agendamento encontrado com os filtros selecionados.</p>';
        return;
    }

    agendamentos.forEach(app => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <div>
                <strong>Dr. ${app.medico_nome}</strong> - CRM: ${app.medico_crm}
                <br>
                <small>${new Date(app.data_integracao).toLocaleDateString('pt-BR')} ${app.horario} | ${app.unidade_nome}</small>
            </div>
            <span class="status ${app.status.toLowerCase()}">${app.status}</span>
        `;
        appointmentList.appendChild(item);
    });
}


async function loadAppointments(token, filters = {}) {
    const { date, unit } = filters;
    
    const query = new URLSearchParams();
    if (date) query.append('data', date); 
    if (unit) query.append('unidade_id', unit); 
    query.append('status', 'AGENDADO'); 
    
    const endpoint = `/api/agendamentos?${query.toString()}`;
    appointmentList.innerHTML = '<p class="placeholder-text">Buscando agendamentos...</p>';
    
    const data = await fetchAuthenticatedData(endpoint, token);
    
    if (data && data.agendamentos) {
        renderAppointments(data.agendamentos);
    } else {
        renderAppointments([]); 
    }
}

// =========================================================================
// EVENT LISTENERS E INICIALIZAÇÃO
// =========================================================================

// Configura os listeners para os filtros de agendamento
function setupAppointmentFilters(token) {
    loadUnits(token); 
    
    const dateInput = document.getElementById('appointment-date');
    const unitSelect = document.getElementById('appointment-unit');
    const searchButton = document.querySelector('.appointment-filters .btn-primary');

    searchButton.addEventListener('click', () => {
        const filters = {
            date: dateInput.value,
            unit: unitSelect.value
        };
        loadAppointments(token, filters);
    });
    
    // Carrega a lista inicial (ex: agendamentos de hoje)
    dateInput.value = new Date().toISOString().split('T')[0];
    loadAppointments(token, { date: dateInput.value });
}


// Verifica o Token e Carrega Dados do Usuário
function initializeDashboard() {
    const token = localStorage.getItem('userToken');
    const userName = localStorage.getItem('userName');

    if (!token || !userName) {
        alert('Sua sessão expirou ou não está logado. Faça o login novamente.');
        window.location.href = '/login.html';
        return;
    }
    
    welcomeMessage.textContent = `Olá, ${userName}`;
    
    updateDateTime();
    setInterval(updateDateTime, 60000); 
    
    // 1. Carrega KPIs
    loadKpis(token);
    
    // 2. Configura e carrega a lista de Agendamentos
    setupAppointmentFilters(token);
    
    // 3. Carrega Pendências Operacionais
    loadOperationalPendencies(token); 
}

// Função de Logout
logoutButton.addEventListener('click', () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userName');
    
    alert('Sessão encerrada com sucesso.');
    window.location.href = '/login.html';
});


// Inicia o dashboard
initializeDashboard();