// public/js/agendamentos-pendentes.js

const tableBody = document.getElementById('agendamentos-table-body');
const selectAllCheckbox = document.getElementById('select-all');
const agendamentoLoteButton = document.getElementById('agendamento-lote-button');
const loteDataInput = document.getElementById('lote-data');
const loteHorarioInput = document.getElementById('lote-horario');
const messageAreaLote = document.getElementById('message-area-lote');
const noDataMessage = document.getElementById('no-data-message');


// --- Funções Auxiliares (Simplificadas) ---

function getToken() {
    // Busca o token (implementado no HTML ou em utils.js)
    return localStorage.getItem('userToken');
}

function showMessage(message, type = 'success', area = messageAreaLote) {
    area.textContent = message;
    area.className = `message-area message-${type}`;
    setTimeout(() => {
        area.textContent = '';
        area.className = 'message-area';
    }, 6000);
}

function formatDate(isoString) {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR').substring(0, 5);
}


// --- 1. Carregar Agendamentos Pendentes ---

async function loadAgendamentosPendentes() {
    const token = getToken();
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    tableBody.innerHTML = '<tr><td colspan="7" class="placeholder-text" style="text-align: center; padding: 20px;">Carregando...</td></tr>';
    agendamentoLoteButton.disabled = true;

    try {
        const response = await fetch('/api/agendamentos/pendentes', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 401) { return getToken(); }

        const data = await response.json();
        renderTable(data.agendamentos);

    } catch (error) {
        console.error('Erro ao carregar agendamentos pendentes:', error);
        tableBody.innerHTML = '<tr><td colspan="7" class="placeholder-text error" style="text-align: center; padding: 20px;">Erro ao carregar dados. Verifique o console.</td></tr>';
    }
}


// --- 2. Renderizar Tabela ---

function renderTable(agendamentos) {
    tableBody.innerHTML = '';
    
    if (agendamentos.length === 0) {
        tableBody.style.display = 'none';
        noDataMessage.style.display = 'block';
        return;
    }
    
    tableBody.style.display = 'table-row-group';
    noDataMessage.style.display = 'none';
    agendamentoLoteButton.disabled = false;

    agendamentos.forEach(item => {
        const row = tableBody.insertRow();
        
        // Coluna Checkbox
        const cellSelect = row.insertCell();
        // Usamos data-agendamento-id para mapear o registro
        cellSelect.innerHTML = `<input type="checkbox" class="agendamento-checkbox" data-agendamento-id="${item.agendamento_id}">`;
        cellSelect.style.textAlign = 'center';

        // Demais Colunas
        row.insertCell().textContent = item.agendamento_id;
        row.insertCell().textContent = item.medico_nome;
        row.insertCell().textContent = item.crm;
        row.insertCell().textContent = item.unidade_nome;
        
        // Conteúdo (PALS/ACLS)
        const contentCell = row.insertCell();
        const content = [];
        if (item.pals) content.push('PALS');
        if (item.acls) content.push('ACLS');
        contentCell.textContent = content.join(' / ') || 'Não Informado';

        // Data Criação
        row.insertCell().textContent = formatDate(item.data_criacao);
    });
}


// --- 3. Manipulação de Checkboxes (Seleção) ---

selectAllCheckbox.addEventListener('change', () => {
    const isChecked = selectAllCheckbox.checked;
    document.querySelectorAll('.agendamento-checkbox').forEach(checkbox => {
        checkbox.checked = isChecked;
    });
});

tableBody.addEventListener('change', (e) => {
    if (e.target.classList.contains('agendamento-checkbox')) {
        const allChecked = Array.from(document.querySelectorAll('.agendamento-checkbox')).every(c => c.checked);
        selectAllCheckbox.checked = allChecked;
    }
});


// --- 4. Submeter Agendamento em Lote (Atualização) ---

agendamentoLoteButton.addEventListener('click', async () => {
    const token = getToken();
    if (!token) return;

    const dataIntegracao = loteDataInput.value;
    const horario = loteHorarioInput.value;
    
    if (!dataIntegracao || !horario) {
        showMessage('Por favor, preencha a Data e o Horário do agendamento em lote.', 'warning');
        return;
    }

    const selectedAgendamentos = Array.from(document.querySelectorAll('.agendamento-checkbox:checked'))
                                    .map(c => parseInt(c.dataset.agendamentoId));

    if (selectedAgendamentos.length === 0) {
        showMessage('Selecione pelo menos um agendamento para processar.', 'warning');
        return;
    }

    // Confirmação do Usuário
    if (!confirm(`Deseja realmente AGENDAR ${selectedAgendamentos.length} registro(s) para o dia ${dataIntegracao} às ${horario}?`)) {
        return;
    }

    agendamentoLoteButton.disabled = true;
    agendamentoLoteButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando Lote...';

    const dataToSend = {
        agendamentos_ids: selectedAgendamentos,
        data_integracao: dataIntegracao,
        horario: horario
    };

    try {
        // Rota para o Agendamento em Lote que irá ATUALIZAR os agendamentos pendentes
        const response = await fetch('/api/agendamentos/lote-atualizacao', {
            method: 'POST', // Usamos POST/PUT para a ação de processamento/atualização
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(dataToSend)
        });

        const result = await response.json();

        if (response.ok) {
            showMessage(result.mensagem || 'Lote processado com sucesso!', 'success');
            // Recarrega a lista
            setTimeout(loadAgendamentosPendentes, 1500); 
        } else {
            showMessage(result.erro || 'Erro ao processar o lote de agendamentos.', 'error');
        }

    } catch (error) {
        console.error('Erro na requisição de lote:', error);
        showMessage('Erro de conexão ao tentar processar o lote.', 'error');
    } finally {
        agendamentoLoteButton.disabled = false;
        agendamentoLoteButton.innerHTML = '<i class="fas fa-calendar-check"></i> Agendar Selecionados em Lote';
        selectAllCheckbox.checked = false; // Desmarca o checkbox de seleção
    }
});


// --- Inicialização ---

document.addEventListener('DOMContentLoaded', () => {
    loadAgendamentosPendentes();
});