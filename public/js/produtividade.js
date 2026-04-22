// public/js/produtividade.js

// 🎯 VARIÁVEIS DE LAYOUT (DECLARAÇÃO LOCAL PARA EVITAR ReferenceError)
//const welcomeMessage = document.getElementById('welcome-message');
//const currentDateTimeElement = document.getElementById('current-datetime');
//const logoutButton = document.getElementById('logout-button');
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.querySelector('.sidebar');

// Elementos Específicos da Produtividade
const kpiTotalAgendamentos = document.getElementById('kpi-total-agendamentos');
const kpiAtivacoesConcluidas = document.getElementById('kpi-ativacoes-concluidas');
const kpiTaxaSucesso = document.getElementById('kpi-taxa-sucesso');
const tableBody = document.getElementById('produtividade-table-body');
const searchButton = document.getElementById('search-produtividade');
const dateInputInicio = document.getElementById('produtividade-periodo-inicio');
const dateInputFim = document.getElementById('produtividade-periodo-fim');
const medicoSelect = document.getElementById('produtividade-medico-select'); // NOVO ELEMENTO


// Funções de utilidade comuns (Replicadas aqui, seguindo o padrão de dashboard.js)
function updateDateTime() {
    const now = new Date();
    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit' };
    
    const date = now.toLocaleDateString('pt-BR', dateOptions);
    const time = now.toLocaleTimeString('pt-BR', timeOptions);
    
    if (currentDateTimeElement) {
        currentDateTimeElement.textContent = `${date} | ${time}`;
    }
}

function setupSidebarToggle() {
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', (event) => {
            event.preventDefault();
            sidebar.classList.toggle('open');
        });
    }
}


// =========================================================================
// FUNÇÃO DE REQUISIÇÃO AUTENTICADA (REPLICADA)
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
        alert('Sessão expirada. Faça o login novamente.');
        window.location.href = '/login.html';
        return null;
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ erro: 'Erro desconhecido.' }));
        throw new Error(`[${response.status}] Falha: ${errorData.erro || response.statusText}`);
    }

    return response.json();
}

// =========================================================================
// LÓGICA DE FILTROS E CARREGAMENTO DE DADOS
// =========================================================================

// NOVO: Carrega a lista de médicos para o filtro
async function loadMedicosFilter(token) {
    try {
        // Assumindo que a lista de médicos é buscada em /api/medicos
        const medicosData = await fetchAuthenticatedData('/api/medicos', token);
        
        if (medicosData && Array.isArray(medicosData)) {
            medicosData.forEach(medico => {
                const option = document.createElement('option');
                option.value = medico.id;
                option.textContent = medico.nome;
                medicoSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar lista de médicos:', error.message);
        // Deixa a opção "Todos" como padrão
    }
}

function renderKpis(data) {
    kpiTotalAgendamentos.textContent = data.totalAgendamentos || '0';
    kpiAtivacoesConcluidas.textContent = data.ativacoesConcluidas || '0';
    kpiTaxaSucesso.textContent = data.taxaSucesso ? `${(data.taxaSucesso * 100).toFixed(1)}%` : '0%';
}

function renderTable(data) {
    tableBody.innerHTML = ''; 
    
    if (!data || data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5">Nenhum dado de produtividade encontrado para o período/médico.</td></tr>';
        return;
    }

    data.forEach(item => {
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td>${item.data}</td>
            <td>${item.total_agendamentos}</td>
            <td>${item.total_ativacoes}</td>
            <td>${item.total_convites}</td>
            <td>${item.horas_trabalhadas || 'N/A'}</td>
        `;
    });
}

// A função de carregamento agora aceita o filtro de médico
async function loadProdutividade(token, filters = {}) {
    if (!token) return;
    
    const { inicio, fim, medicoId } = filters;
    
    const query = new URLSearchParams();
    if (inicio) query.append('inicio', inicio);
    if (fim) query.append('fim', fim);
    if (medicoId) query.append('medicoId', medicoId); // NOVO FILTRO
    
    const endpoint = `/api/produtividade?${query.toString()}`;
    tableBody.innerHTML = '<tr><td colspan="5">Buscando dados de produtividade...</td></tr>';
    
    try {
        const data = await fetchAuthenticatedData(endpoint, token); 
        
        // 🎯 O backend DEVE retornar { kpis: {}, detalhes: [] }
        if (data && data.kpis && data.detalhes) {
            renderKpis(data.kpis);
            renderTable(data.detalhes);
        } else {
            renderKpis({});
            tableBody.innerHTML = '<tr><td colspan="5">Resposta da API incompleta ou formato inválido.</td></tr>';
            renderTable([]);
        }

    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="5" class="error-text">Erro ao carregar dados: ${error.message}</td></tr>`;
        renderKpis({});
    }
}

// =========================================================================
// INICIALIZAÇÃO
// =========================================================================

function initializeProdutividade() {
    const token = localStorage.getItem('userToken');
    const userName = localStorage.getItem('userName');

    if (!token || !userName) {
        alert('Sua sessão expirou ou não está logado. Faça o login novamente.');
        window.location.href = '/login.html';
        return;
    }
    
    if (welcomeMessage) {
        welcomeMessage.textContent = `Olá, ${userName}`;
    }
    
    setupSidebarToggle();
    updateDateTime();
    setInterval(updateDateTime, 60000); 
    
    // Configura a data padrão
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);

    const formatDate = (date) => date.toISOString().split('T')[0];
    
    dateInputInicio.value = formatDate(lastWeek);
    dateInputFim.value = formatDate(today);

    // Carrega filtros e dados iniciais
    loadMedicosFilter(token);

    loadProdutividade(token, {
        inicio: dateInputInicio.value,
        fim: dateInputFim.value,
        medicoId: medicoSelect.value
    });

    // Listener para o botão de busca
    searchButton.addEventListener('click', () => {
        loadProdutividade(token, {
            inicio: dateInputInicio.value,
            fim: dateInputFim.value,
            medicoId: medicoSelect.value
        });
    });
    
    // Listener para o botão de Logout 
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('userToken');
            localStorage.removeItem('userName');
            alert('Sessão encerrada com sucesso.');
            window.location.href = '/login.html';
        });
    }
}

// Inicia a página
initializeProdutividade();