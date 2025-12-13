// public/js/medicos-lista.js

const welcomeMessage = document.getElementById('welcome-message');
const logoutButton = document.getElementById('logout-button');
const unidadeFilter = document.getElementById('filter-unidade'); 
const medicosTableBody = document.getElementById('medicos-table-body');
// const searchButton foi removida, pois o botão não existe mais no HTML.

const COLSPAN_COUNT = 6; // Confirma 6 colunas na tabela

let allMedicosData = []; // Armazena a lista completa de médicos

// --- Funções de Utilitário ---

function getToken() {
    const token = localStorage.getItem('userToken');
    const userName = localStorage.getItem('userName');

    if (!token || !userName) {
        alert('Sessão inválida ou expirada. Faça o login novamente.');
        window.location.href = '/login.html';
        return null;
    }
    document.getElementById('welcome-message').textContent = `Olá, ${userName}`;
    return token;
}

async function fetchAuthenticated(endpoint, method = 'GET', body = null) {
    const token = getToken();
    if (!token) return null;

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
    
    const options = {
        method: method,
        headers: headers,
    };

    if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(endpoint, options);

    if (response.status === 401) { 
        getToken(); 
        return null;
    }

    return response;
}

document.getElementById('logout-button').addEventListener('click', () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userName');
    alert('Sessão encerrada com sucesso.');
    window.location.href = '/login.html';
});

// --- Carregar Unidades para o Filtro ---

async function loadUnitsForFilter() {
    try {
        const response = await fetchAuthenticated('/api/unidades');
        if (!response) return;

        const data = await response.json();

        if (data.unidades && data.unidades.length > 0) {
            unidadeFilter.innerHTML = '<option value="">Todas as Unidades</option>'; 
            
            data.unidades.forEach(unit => {
                const option = document.createElement('option');
                option.value = unit.id; 
                option.textContent = unit.nome;
                unidadeFilter.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar unidades para filtro:', error);
    }
}

// --- Carregar Lista de Médicos ---

async function loadMedicos() {
    medicosTableBody.innerHTML = `<tr><td colspan="${COLSPAN_COUNT}" class="placeholder-text"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>`; 

    try {
        const response = await fetchAuthenticated('/api/medicos');
        if (!response) return;

        const data = await response.json();

        if (response.ok) {
            allMedicosData = data; 
            renderMedicosTable(allMedicosData);
        } else {
            const errorMessage = data.erro || 'Falha ao carregar médicos.';
            medicosTableBody.innerHTML = `<tr><td colspan="${COLSPAN_COUNT}" class="placeholder-error">Erro: ${errorMessage}</td></tr>`; 
        }

    } catch (error) {
        console.error('Erro ao carregar lista de médicos:', error);
        medicosTableBody.innerHTML = `<tr><td colspan="${COLSPAN_COUNT}" class="placeholder-error">Erro de conexão com a API.</td></tr>`; 
    }
}

// --- Ações de Edição e Exclusão (Mantidas) ---

function handleEditClick(medicoId) {
    window.location.href = `/medicos-cadastro.html?id=${medicoId}`;
}

async function handleDeleteClick(medicoId) {
    if (!confirm('Tem certeza que deseja desativar (excluir logicamente) este médico? Essa ação é reversível apenas pelo banco de dados.')) {
        return;
    }

    try {
        const response = await fetchAuthenticated(`/api/medicos/${medicoId}`, 'DELETE');
        if (!response) return;

        const data = await response.json();

        if (response.ok) {
            alert(data.mensagem);
            loadMedicos(); 
        } else {
            alert(`Falha ao desativar: ${data.erro || 'Erro desconhecido.'}`);
        }
    } catch (error) {
        console.error('Erro ao desativar médico:', error);
        alert('Erro de conexão ao tentar desativar o médico.');
    }
}

function addEventListenersToActions() {
    document.querySelectorAll('.btn-edit').forEach(button => {
        button.addEventListener('click', (e) => {
            const medicoId = e.currentTarget.dataset.id;
            handleEditClick(medicoId);
        });
    });

    document.querySelectorAll('.btn-delete').forEach(button => {
        button.addEventListener('click', (e) => {
            const medicoId = e.currentTarget.dataset.id;
            handleDeleteClick(medicoId);
        });
    });
}

// --- Renderizar Tabela (Com 6 colunas) ---

function renderMedicosTable(medicos) {
    medicosTableBody.innerHTML = ''; 

    if (!Array.isArray(medicos) || medicos.length === 0) { 
        medicosTableBody.innerHTML = `<tr><td colspan="${COLSPAN_COUNT}" class="placeholder-text">Nenhum médico encontrado com os filtros aplicados.</td></tr>`; 
        return;
    }

    medicos.forEach(medico => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${medico.nome}</td>
            <td>${medico.crm}</td>
            <td>${medico.telefone || 'N/A'}</td> 
            <td>${medico.especialidade}</td>
            <td>${medico.unidade_nome || 'N/A'}</td>
            <td>
                <button class="btn-icon btn-edit" title="Editar Médico" data-id="${medico.id}">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon btn-delete" title="Excluir Médico" data-id="${medico.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        medicosTableBody.appendChild(row);
    });

    addEventListenersToActions();
}

// --- Lógica de Filtros (APENAS POR UNIDADE) ---

function applyFilters() {
    const unitId = unidadeFilter.value;

    const filtered = allMedicosData.filter(medico => {
        // Filtra pela Unidade (se unitId for vazio, retorna true para todos)
        const unitMatch = !unitId || (medico.unidade_id && medico.unidade_id.toString() === unitId);
        
        return unitMatch;
    });

    renderMedicosTable(filtered);
}

// --- Inicialização e Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    const token = getToken();
    if (token) {
        loadUnitsForFilter();
        loadMedicos();
    }
});

// Listener AGORA é APENAS no evento 'change' do select de unidade.
unidadeFilter.addEventListener('change', applyFilters);