// public/js/agendamentos-lote.js

const unidadeSelect = document.getElementById('unidade_agendada');
const medicosTableBody = document.getElementById('medicos-table-body');
const selectAllCheckbox = document.getElementById('select-all');
const loteForm = document.getElementById('lote-agendamento-form');
const submitButton = document.getElementById('submit-lote-button');
const countSelectedSpan = document.getElementById('count-selected');
const messageArea = document.getElementById('message-area');

let allMedicosData = [];

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

function showMessage(message, type = 'success') {
    // Limpa mensagens anteriores na área de tabela
    messageArea.textContent = message;
    messageArea.className = `message-area message-${type}`;
    setTimeout(() => {
        messageArea.textContent = '';
        messageArea.className = 'message-area';
    }, 8000); // Exibe por 8 segundos para feedback de lote
}

// --- 1. Carregar Unidades ---

async function loadUnits() {
    const token = getToken();
    if (!token) return;

    try {
        const response = await fetch('/api/unidades', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });

        if (response.status === 401) { return getToken(); }
        const data = await response.json();

        if (response.ok && data.unidades && data.unidades.length > 0) {
            unidadeSelect.innerHTML = '<option value="" disabled selected>Selecione a Unidade</option>'; 
            data.unidades.forEach(unit => {
                const option = document.createElement('option');
                option.value = unit.id; 
                option.textContent = unit.nome;
                unidadeSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar unidades:', error);
        showMessage('Erro ao carregar unidades.', 'error');
    }
}


// --- 2. Carregar Médicos Elegíveis ---

async function loadMedicosSemAgendamento() {
    const token = getToken();
    if (!token) return;

    medicosTableBody.innerHTML = '<tr><td colspan="4" class="placeholder-text"><i class="fas fa-spinner fa-spin"></i> Buscando médicos...</td></tr>';
    
    try {
        // Rota que busca médicos sem agendamento (criada no medicoController)
        const response = await fetch('/api/medicos/sem-agendamento', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });

        if (response.status === 401) { return getToken(); }

        const result = await response.json();

        if (response.ok) {
            allMedicosData = result.medicos || [];
            renderMedicosTable(allMedicosData);
        } else {
             showMessage(result.erro || 'Falha ao carregar a lista de médicos elegíveis.', 'error');
             medicosTableBody.innerHTML = `<tr><td colspan="4" class="placeholder-error">Erro: ${result.erro || 'Falha ao carregar lista.'}</td></tr>`;
        }

    } catch (error) {
        console.error('Erro ao carregar médicos sem agendamento:', error);
        showMessage('Erro de conexão ao buscar médicos.', 'error');
        medicosTableBody.innerHTML = '<tr><td colspan="4" class="placeholder-error">Erro de conexão com a API.</td></tr>';
    }
}


// --- 3. Renderização e Gerenciamento de Seleção ---

function updateSelectionCount() {
    const selectedCheckboxes = medicosTableBody.querySelectorAll('input[type="checkbox"]:checked');
    countSelectedSpan.textContent = selectedCheckboxes.length;
    submitButton.disabled = selectedCheckboxes.length === 0;
}

function handleSelectAll() {
    const isChecked = selectAllCheckbox.checked;
    const checkboxes = medicosTableBody.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = isChecked;
    });
    updateSelectionCount();
}

function renderMedicosTable(medicos) {
    medicosTableBody.innerHTML = ''; 

    if (medicos.length === 0) {
        medicosTableBody.innerHTML = '<tr><td colspan="4" class="placeholder-text">Nenhum médico novo encontrado sem agendamento.</td></tr>';
        selectAllCheckbox.disabled = true;
        return;
    }
    selectAllCheckbox.disabled = false;
    selectAllCheckbox.checked = false;

    medicos.forEach(medico => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="checkbox" data-medico-id="${medico.id}"></td>
            <td>${medico.nome}</td>
            <td>${medico.crm}</td>
            <td>${medico.unidade_nome || 'N/A'}</td>
        `;
        medicosTableBody.appendChild(row);
    });

    // Adiciona listener para cada checkbox individualmente
    medicosTableBody.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', updateSelectionCount);
    });
}

// --- 4. Submissão do Lote ---

loteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;

    const selectedCheckboxes = medicosTableBody.querySelectorAll('input[type="checkbox"]:checked');
    const medico_ids = Array.from(selectedCheckboxes).map(cb => cb.dataset.medicoId);
    
    if (medico_ids.length === 0) {
        showMessage('Selecione pelo menos um médico para agendar.', 'error');
        return;
    }
    
    // Captura os dados do formulário de agendamento
    const data_integracao = document.getElementById('data_integracao').value;
    const horario = document.getElementById('horario').value;
    const unidade_agendada = unidadeSelect.value;
    const pals = document.getElementById('pals').checked;
    const acls = document.getElementById('acls').checked;

    if (!data_integracao || !horario || !unidade_agendada) {
        showMessage('Por favor, preencha todos os detalhes do agendamento (Data, Horário e Unidade).', 'error');
        return;
    }

    if (!confirm(`Confirmar agendamento de ${medico_ids.length} médico(s) para ${data_integracao} às ${horario}?`)) {
        return;
    }
    
    submitButton.disabled = true;
    submitButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processando Lote...`;

    const payload = {
        medico_ids,
        data_integracao,
        horario,
        unidade_agendada: parseInt(unidade_agendada), // Garante que é um número (ID)
        pals,
        acls
    };

    try {
        // Rota para criação de lote (criada no agendamentoController)
        const response = await fetch('/api/agendamentos/lote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (response.ok) {
            let detailMessage = result.mensagem;
            if (result.falhas && result.falhas.length > 0) {
                detailMessage += ` ${result.falhas.length} falha(s) ocorreram. Verifique os logs.`;
                showMessage(detailMessage, 'warning');
            } else {
                showMessage(detailMessage, 'success');
            }
            
            // Recarrega a lista para mostrar apenas os remanescentes (se houver falhas)
            // ou uma lista vazia (se todos foram agendados)
            await loadMedicosSemAgendamento(); 
            // Resetar o formulário de data/hora (opcional, mas limpa o estado)
            loteForm.reset(); 
        } else {
            showMessage(result.erro || 'Falha na submissão do lote.', 'error');
        }

    } catch (error) {
        console.error('Erro na submissão do lote:', error);
        showMessage('Erro de conexão com o servidor ao enviar o lote.', 'error');
    } finally {
        submitButton.disabled = false; // A reabilitação final acontece após o updateSelectionCount
        updateSelectionCount(); 
        submitButton.innerHTML = `<i class="fas fa-layer-group"></i> Agendar Lote (<span id="count-selected">${medico_ids.length}</span> médicos)`;
    }
});


// --- Inicialização e Event Listeners ---

selectAllCheckbox.addEventListener('change', handleSelectAll);
document.getElementById('logout-button').addEventListener('click', () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userName');
    alert('Sessão encerrada com sucesso.');
    window.location.href = '/login.html';
});

document.addEventListener('DOMContentLoaded', () => {
    const token = getToken();
    if (token) {
        loadUnits(); // Carrega as unidades para o campo de seleção
        loadMedicosSemAgendamento(); // Carrega os médicos para a tabela
    }
});