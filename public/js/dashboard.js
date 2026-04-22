// public/js/dashboard.js

const welcomeMessage = document.getElementById('welcome-message');
const currentDateTimeElement = document.getElementById('current-datetime');
const logoutButton = document.getElementById('logout-button');
const appointmentList = document.getElementById('agendamentos-list');
const pendenciasList = document.getElementById('pendencias-list'); 
const weeklyCalendar = document.getElementById('weekly-calendar'); 

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

async function fetchAuthenticatedData(endpoint, token) {
    const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    if (response.status === 401) {
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
// 🎯 ATUALIZADO: AGENDA SEMANA CORRENTE (SEG A SEX) - APENAS STATUS AGENDADO
// =========================================================================

async function renderWeeklyCalendar(token) {
    if (!weeklyCalendar) return;
    
    const data = await fetchAuthenticatedData('/api/agendamentos', token);
    const agendamentos = data && data.agendamentos ? data.agendamentos : [];

    weeklyCalendar.innerHTML = '';
    
    // Lógica para encontrar a Segunda-feira da semana atual
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 (Dom) a 6 (Sáb)
    const diffToMonday = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diffToMonday));
    
    // Loop de 5 dias (Segunda a Sexta)
    for (let i = 0; i < 5; i++) {
        const currentDate = new Date(monday);
        currentDate.setDate(monday.getDate() + i);
        const dateString = currentDate.toISOString().split('T')[0];

        const col = document.createElement('div');
        col.className = 'calendar-day-column';
        
        const dayLabel = currentDate.toLocaleDateString('pt-BR', { weekday: 'short' });
        const dayNum = currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

        col.innerHTML = `<div class="day-header"><span>${dayLabel}</span><h4>${dayNum}</h4></div>`;

        // 🎯 FILTRO: Apenas o que estiver com status AGENDADO para o dia específico
        const dailyApps = agendamentos.filter(a => 
            a.data_integracao && 
            a.data_integracao.startsWith(dateString) && 
            a.status.toUpperCase() === 'AGENDADO'
        );

        if (dailyApps.length > 0) {
            dailyApps.forEach(app => {
                const card = document.createElement('div');
                card.className = `appointment-mini-card status-agendado`;
                card.innerHTML = `
                    <strong>${app.horario || '--:--'}</strong>
                    <span>Dr. ${app.medico_nome ? app.medico_nome.split(' ')[0] : 'Médico'}</span>
                    <em>${app.unidade_nome || 'Unidade'}</em>
                `;
                col.appendChild(card);
            });
        } else {
            col.innerHTML += `<p class="no-appointments">Vazio</p>`;
        }
        weeklyCalendar.appendChild(col);
    }
}

// =========================================================================
// LÓGICA DE CARREGAMENTO DE UNIDADES E KPIs
// =========================================================================

async function loadUnits(token) {
    const unitSelect = document.getElementById('appointment-unit');
    if (!unitSelect) return;

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
    }
}

function renderKpis(data) {
    document.getElementById('total-medicos').textContent = data.totalMedicos || '0';
    document.getElementById('agendamentos-semana').textContent = data.agendamentosSemana || '0';
    document.getElementById('treinamentos-mes').textContent = data.treinamentosMes || '0';
    document.getElementById('atendimentos-ano').textContent = data.atendimentosAno || '0';
}

async function loadKpis(token) {
    const data = await fetchAuthenticatedData('/api/dashboard/kpis', token); 
    if (data) renderKpis(data);
}

// =========================================================================
// 🎯 ATUALIZADO: PENDÊNCIAS OPERACIONAIS (TERMOS REMOVIDOS)
// =========================================================================

async function loadOperationalPendencies(token) {
    if (!token) return;

    try {
        const data = await fetchAuthenticatedData('/api/agendamentos', token);
        const agendamentos = data.agendamentos || [];

        pendenciasList.innerHTML = ''; 

        // Agendamentos Pendentes
        const pendentesTotal = agendamentos.filter(a => a.status === 'PENDENTE').length;
        const itemPendente = document.createElement('li');
        itemPendente.style.cursor = 'pointer';
        itemPendente.innerHTML = `Agendamentos Pendentes: <span>${pendentesTotal}</span>`;
        itemPendente.onclick = () => window.location.href = '/agendamentos.html';
        pendenciasList.appendChild(itemPendente);

        // Aguardando Integração
        const aguardandoInteg = agendamentos.filter(a => a.status === 'AGENDADO').length;
        const itemInteg = document.createElement('li');
        itemInteg.style.cursor = 'pointer';
        itemInteg.innerHTML = `Aguardando Integração: <span>${aguardandoInteg}</span>`;
        itemInteg.onclick = () => window.location.href = '/agendamentos.html?status=AGENDADO';
        pendenciasList.appendChild(itemInteg);

        // 🎯 AJUSTADO: Aguardando Confirmação do Médico (Aceita CONVITE ENVIADO ou CONVITE_ENVIADO)
        const aguardandoConf = agendamentos.filter(a => 
            a.status === 'CONVITE ENVIADO' || a.status === 'CONVITE_ENVIADO'
        ).length;
        
        const itemConf = document.createElement('li');
        itemConf.style.cursor = 'pointer';
        itemConf.innerHTML = `Aguardando Confirmação Médico(a): <span>${aguardandoConf}</span>`;
        itemConf.onclick = () => window.location.href = '/agendamentos.html?status=CONVITE_ENVIADO';
        pendenciasList.appendChild(itemConf);

        // 🎯 REMOVIDO: Termos não lidos conforme solicitado.
        
    } catch (error) {
        console.error('Erro ao carregar pendências:', error);
    }
}

// =========================================================================
// 🎯 ATUALIZADO: PESQUISA (SÓ BUSCA AO CLICAR EM BUSCAR)
// =========================================================================

function renderAppointments(agendamentos) {
    appointmentList.innerHTML = ''; 

    if (!agendamentos || agendamentos.length === 0) {
        appointmentList.innerHTML = '<p class="placeholder-text">Nenhum agendamento encontrado para este filtro.</p>';
        return;
    }

    agendamentos.forEach(app => {
        const item = document.createElement('div');
        item.className = 'list-item';
        const dataExibicao = app.data_integracao ? new Date(app.data_integracao).toLocaleDateString('pt-BR') : 'Sem data';
        
        item.innerHTML = `
            <div>
                <strong>Dr. ${app.medico_nome || 'Não informado'}</strong>
                <br>
                <small>${dataExibicao} ${app.horario || ''} | ${app.unidade_nome || 'Unidade N/I'}</small>
            </div>
            <span class="status ${app.status.toLowerCase().replace(/\s+/g, '-')}">${app.status}</span>
        `;
        appointmentList.appendChild(item);
    });
}

async function loadAppointments(token, filters = {}) {
    const { date, unit } = filters;
    
    // 🎯 Só executa se houver pelo menos um filtro selecionado para evitar redundância na tela
    if (!date && !unit) return;

    const query = new URLSearchParams();
    if (date) query.append('data', date);
    if (unit) query.append('unidade_id', unit);
    
    const endpoint = `/api/agendamentos?${query.toString()}`;
    appointmentList.innerHTML = '<p class="placeholder-text"><i class="fas fa-spinner fa-spin"></i> Buscando...</p>';
    
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

function setupAppointmentFilters(token) {
    loadUnits(token); 
    
    const dateInput = document.getElementById('appointment-date');
    const unitSelect = document.getElementById('appointment-unit');
    const searchButton = document.querySelector('.appointment-filters .btn-primary');

    if (searchButton) {
        searchButton.addEventListener('click', () => {
            loadAppointments(token, { date: dateInput.value, unit: unitSelect.value });
        });
    }
    
    // Campo de data por padrão vem com hoje, mas não dispara o load automático
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
}

function initializeDashboard() {
    const token = localStorage.getItem('userToken');
    const userName = localStorage.getItem('userName');

    if (!token || !userName) {
        window.location.href = '/login.html';
        return;
    }
    
    if (welcomeMessage) welcomeMessage.textContent = `Olá, ${userName}`;
    
    updateDateTime();
    setInterval(updateDateTime, 60000); 
    
    loadKpis(token);
    setupAppointmentFilters(token);
    loadOperationalPendencies(token); 
    renderWeeklyCalendar(token); 
}

if (logoutButton) {
    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('userToken');
        localStorage.removeItem('userName');
        window.location.href = '/login.html';
    });
}

initializeDashboard();