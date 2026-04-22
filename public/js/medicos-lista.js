// public/js/medicos-lista.js

const welcomeMessage = document.getElementById('welcome-message');
const logoutButton = document.getElementById('logout-button');
const unidadeFilter = document.getElementById('filter-unidade'); 
const buscaInput = document.getElementById('filter-busca'); 
const btnLimpar = document.getElementById('btn-limpar');
const medicosTableBody = document.getElementById('medicos-table-body');

// Elementos da Modal
const modal = document.getElementById('modal-detalhes');
const detalhesConteudo = document.getElementById('detalhes-conteudo');
const closeModal = document.querySelector('.close-modal');

const COLSPAN_COUNT = 7; 
let allMedicosData = []; 

// --- Funções de Utilitário e Autenticação ---

function getToken() {
    const token = localStorage.getItem('userToken');
    const userName = localStorage.getItem('userName');
    if (!token || !userName) {
        window.location.href = '/login.html';
        return null;
    }
    welcomeMessage.textContent = `Olá, ${userName}`;
    return token;
}

async function fetchAuthenticated(endpoint, method = 'GET', body = null) {
    const token = getToken();
    if (!token) return null;
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    const options = { method, headers };
    if (body && method !== 'GET') options.body = JSON.stringify(body);
    
    try {
        const response = await fetch(endpoint, options);
        if (response.status === 401) { 
            window.location.href = '/login.html'; 
            return null; 
        }
        return response;
    } catch (error) {
        console.error("Erro na requisição:", error);
        return null;
    }
}

logoutButton.addEventListener('click', () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userName');
    window.location.href = '/login.html';
});

// --- Lógica da Modal ---

function showDetails(medicoId) {
    const medico = allMedicosData.find(m => m.id.toString() === medicoId.toString());
    if (!medico) return;

    detalhesConteudo.innerHTML = `
        <div><b>Nome Completo</b>${medico.nome}</div>
        <div><b>CRM</b>${medico.crm}</div>
        <div><b>CPF</b>${medico.cpf || 'Não informado'}</div>
        <div><b>Especialidade</b>${medico.especialidade}</div>
        <div><b>Telefone</b>${medico.telefone || 'N/A'}</div>
        <div><b>E-mail</b>${medico.email || 'N/A'}</div>
        <div style="grid-column: span 2;"><b>Unidade Atuante</b>${medico.unidade_nome || 'N/A'}</div>
    `;
    modal.style.display = "block";
}

if (closeModal) {
    closeModal.onclick = () => modal.style.display = "none";
}

window.onclick = (event) => { 
    if (event.target == modal) modal.style.display = "none"; 
};

// --- Carregamento de Dados ---

async function loadUnitsForFilter() {
    try {
        const response = await fetchAuthenticated('/api/unidades');
        if (response && response.ok) {
            const rawData = await response.json();
            
            // Tratamento do erro "forEach is not a function":
            // Garante que 'unidades' seja sempre um array, independente se a API envia [] ou { data: [] }
            const unidades = Array.isArray(rawData) ? rawData : (rawData.unidades || rawData.data || []);
            
            unidadeFilter.innerHTML = '<option value="">Todas as Unidades</option>';
            
            if (unidades.length === 0) {
                console.warn("Nenhuma unidade encontrada na resposta da API.");
                return;
            }

            unidades.forEach(unit => {
                const option = document.createElement('option');
                option.value = unit.id; 
                option.textContent = unit.nome; 
                unidadeFilter.appendChild(option);
            });
        } else {
            console.error("Erro ao carregar unidades: Status", response?.status);
        }
    } catch (err) {
        console.error("Erro crítico na função loadUnitsForFilter:", err);
    }
}

async function loadMedicos() {
    medicosTableBody.innerHTML = `<tr><td colspan="${COLSPAN_COUNT}" class="placeholder-text"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>`; 
    const response = await fetchAuthenticated('/api/medicos');
    if (response && response.ok) {
        const data = await response.json();
        // Tratamento similar para médicos caso a API não retorne array direto
        allMedicosData = Array.isArray(data) ? data : (data.medicos || data.data || []);
        renderMedicosTable(allMedicosData);
    } else {
        medicosTableBody.innerHTML = `<tr><td colspan="${COLSPAN_COUNT}" class="placeholder-error">Erro ao carregar dados.</td></tr>`;
    }
}

// --- Renderização e Filtros ---

function renderMedicosTable(medicos) {
    medicosTableBody.innerHTML = ''; 
    if (!Array.isArray(medicos) || medicos.length === 0) { 
        medicosTableBody.innerHTML = `<tr><td colspan="${COLSPAN_COUNT}" class="placeholder-text">Nenhum médico encontrado.</td></tr>`; 
        return;
    }

    medicos.forEach(medico => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="text-align:center;"><button class="btn-icon btn-view" title="Ver Detalhes" data-id="${medico.id}"><i class="fas fa-eye" style="color:#3498db"></i></button></td>
            <td>${medico.nome}</td>
            <td>${medico.crm}</td>
            <td>${medico.telefone || 'N/A'}</td> 
            <td>${medico.especialidade}</td>
            <td>${medico.unidade_nome || 'N/A'}</td>
            <td>
                <button class="btn-icon btn-edit" title="Editar" data-id="${medico.id}"><i class="fas fa-edit"></i></button>
                <button class="btn-icon btn-delete" title="Excluir" data-id="${medico.id}"><i class="fas fa-trash"></i></button>
            </td>
        `;
        medicosTableBody.appendChild(row);
    });
    addEventListenersToActions();
}

function applyFilters() {
    const unitId = unidadeFilter.value;
    const termo = buscaInput.value.toLowerCase().trim();

    const filtered = allMedicosData.filter(medico => {
        // Filtro por Unidade (converte ambos para string para garantir comparação correta)
        const matchUnidade = !unitId || (medico.unidade_id && medico.unidade_id.toString() === unitId.toString());
        
        // Filtro por Texto usando .includes() para não ser restrito apenas ao início da string
        const matchTexto = !termo || 
            (medico.nome && medico.nome.toLowerCase().includes(termo)) ||
            (medico.crm && medico.crm.toString().toLowerCase().includes(termo)) ||
            (medico.cpf && medico.cpf.toString().toLowerCase().includes(termo));

        return matchUnidade && matchTexto;
    });

    renderMedicosTable(filtered);
}

// --- Ações ---

function addEventListenersToActions() {
    document.querySelectorAll('.btn-view').forEach(btn => {
        btn.onclick = () => showDetails(btn.dataset.id);
    });
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.onclick = () => window.location.href = `/medicos-cadastro.html?id=${btn.dataset.id}`;
    });
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('Deseja desativar este médico?')) {
                const res = await fetchAuthenticated(`/api/medicos/${btn.dataset.id}`, 'DELETE');
                if (res && res.ok) loadMedicos();
            }
        };
    });
}

// Lógica do botão Limpar
if (btnLimpar) {
    btnLimpar.onclick = () => {
        buscaInput.value = '';
        unidadeFilter.value = '';
        renderMedicosTable(allMedicosData); 
    };
}

// --- Inicialização ---

document.addEventListener('DOMContentLoaded', () => {
    if (getToken()) {
        loadUnitsForFilter();
        loadMedicos();
    }
});

unidadeFilter.addEventListener('change', applyFilters);
buscaInput.addEventListener('input', applyFilters);