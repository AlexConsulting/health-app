// public/js/medicos-cadastro.js

const medicoForm = document.getElementById('medico-form');
const unidadeSelect = document.getElementById('unidade_id');
const messageArea = document.getElementById('message-area');
const submitButton = document.getElementById('submit-button');

// Elementos da seção de Agendamento (Mantidos)
const trainingTitle = document.getElementById('training-title');
const trainingFields = document.getElementById('training-fields');


// Variável para armazenar o ID do médico em edição
let editingMedicoId = null; 


// --- Funções de Utilitário (Mantidas) ---

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
    // Esta função atua como seu "modal" ou área de notificação
    messageArea.textContent = message;
    messageArea.className = `message-area message-${type}`;
    setTimeout(() => {
        messageArea.textContent = '';
        messageArea.className = 'message-area';
    }, 5000);
}

function getMedicoIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// --- 1. Carregar Unidades (Mantida) ---

async function loadUnits(token, selectedUnitId = null) {
    unidadeSelect.innerHTML = '<option value="" disabled selected>Carregando unidades...</option>';
    
    try {
        const response = await fetch('/api/unidades', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 401) { return getToken(); }

        const data = await response.json();

        unidadeSelect.innerHTML = ''; // Limpa o placeholder

        if (data.unidades && data.unidades.length > 0) {
            const defaultOption = document.createElement('option');
            defaultOption.value = "";
            defaultOption.textContent = "Selecione uma Unidade";
            defaultOption.disabled = true;
            if (!selectedUnitId) { 
                defaultOption.selected = true;
            }
            unidadeSelect.appendChild(defaultOption);
            
            data.unidades.forEach(unit => {
                const option = document.createElement('option');
                option.value = unit.id; 
                option.textContent = unit.nome;
                if (selectedUnitId && unit.id.toString() === selectedUnitId.toString()) {
                    option.selected = true;
                }
                unidadeSelect.appendChild(option);
            });
        } else {
            unidadeSelect.innerHTML = '<option value="" disabled selected>Nenhuma unidade cadastrada</option>';
            unidadeSelect.disabled = true;
            showMessage('Nenhuma unidade encontrada. O cadastro não pode ser realizado.', 'error');
        }

    } catch (error) {
        console.error('Erro ao carregar unidades:', error);
        unidadeSelect.innerHTML = '<option value="" disabled selected>Erro ao carregar unidades</option>';
        unidadeSelect.disabled = true;
    }
}


// --- 2. Lógica de Edição (Mantida) ---

async function loadMedicoForEditing(medicoId, token) {
    try {
        const response = await fetch(`/api/medicos/${medicoId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.status === 404) {
            showMessage('Médico não encontrado.', 'error');
            return null;
        }
        if (!response.ok) {
            const result = await response.json();
            showMessage(result.erro || 'Erro ao carregar dados para edição.', 'error');
            return null;
        }
        
        const medicoData = await response.json();
        return medicoData; 
        
    } catch (error) {
        console.error('Erro ao buscar dados do médico:', error);
        showMessage('Erro de conexão ao carregar dados do médico.', 'error');
        return null;
    }
}

function populateForm(medico) {
    // Popula campos básicos
    document.getElementById('nome').value = medico.nome;
    document.getElementById('crm').value = medico.crm;
    document.getElementById('especialidade').value = medico.especialidade;
    
    // Popula NOVOS campos
    document.getElementById('data_nasc').value = medico.data_nasc ? medico.data_nasc.split('T')[0] : '';
    document.getElementById('rqe').value = medico.rqe || '';
    
    // Popula checkboxes (Áreas de Atuação)
    document.getElementById('porta').checked = medico.porta;
    document.getElementById('emergencia').checked = medico.emergencia;
    document.getElementById('enfermaria').checked = medico.enfermaria;
    document.getElementById('ambulatorio').checked = medico.ambulatorio;
    document.getElementById('uti').checked = medico.uti;

    // Atualiza título e botão
    const titleElement = document.querySelector('.main-content h2'); 
    if (titleElement) {
        titleElement.textContent = '✏️ Editar Médico';
    }
    
    // Na edição, oculta a seção de agendamento
    if (trainingTitle) {
        trainingTitle.style.display = 'none';
    }
    if (trainingFields) {
        trainingFields.style.display = 'none';
    }
    
    submitButton.innerHTML = '<i class="fas fa-save"></i> Salvar Alterações';
    submitButton.classList.remove('btn-primary');
    submitButton.classList.add('btn-success');
}


// --- 3. Enviar Formulário de Cadastro/Edição (FINALMENTE CORRIGIDO PARA O MODAL) ---

medicoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const token = getToken();
    if (!token) return;

    const isEditing = editingMedicoId !== null;
    const method = isEditing ? 'PUT' : 'POST';
    const endpoint = isEditing ? `/api/medicos/${editingMedicoId}` : '/api/medicos';

    submitButton.disabled = true;
    submitButton.innerHTML = isEditing ? '<i class="fas fa-spinner fa-spin"></i> Salvando...' : '<i class="fas fa-spinner fa-spin"></i> Cadastrando...';
    messageArea.textContent = '';

    const formData = new FormData(medicoForm);
    const data = Object.fromEntries(formData.entries());
    
    // --- Dados do Médico ---
    const medicoData = {
        nome: data.nome,
        crm: data.crm,
        especialidade: data.especialidade,
        unidade_id: parseInt(data.unidade_id, 10), 
        
        // Novos campos
        porta: !!data.porta,
        emergencia: !!data.emergencia,
        enfermaria: !!data.enfermaria,
        ambulatorio: !!data.ambulatorio,
        uti: !!data.uti,
        data_nasc: data.data_nasc || null,
        rqe: data.rqe || null,

        // Adicionando CPF, telefone, email, empresa e observacao
        cpf: data.cpf || null, 
        telefone: data.telefone || null, 
        email: data.email || null, 
        empresa: data.empresa || null, 
        observacao: data.observacao || null, 
        
        // PALS e ACLS são enviados para que o medicoController crie o Agendamento PENDENTE
        pals: data.pals,
        acls: data.acls
    };
    
    try {
        // PASSO 1: TENTAR CADASTRO/EDIÇÃO DO MÉDICO
        const response = await fetch(endpoint, {
            method: method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(medicoData)
        });

        const result = await response.json();

        if (response.ok) {
            
            let finalMessage = result.mensagem;
            
            if (!isEditing) {
                // PARA NOVO CADASTRO: Usa alert() (modal) e depois limpa o form
                alert('✅ Sucesso: ' + finalMessage); 
                medicoForm.reset(); 
                
            } else {
                // PARA EDIÇÃO: Usa showMessage (alerta não-bloqueante) e redireciona
                showMessage(finalMessage, 'success');
                
                 setTimeout(() => {
                     window.location.href = '/medicos-lista.html'; 
                 }, 1500); 
            }
            
        } else {
            // Exibe a mensagem de erro (do backend)
            showMessage(result.erro || 'Erro desconhecido ao processar o médico.', 'error');
        }

    } catch (error) {
        console.error('Erro na requisição:', error);
        showMessage('Erro de conexão com o servidor.', 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = isEditing ? '<i class="fas fa-save"></i> Salvar Alterações' : '<i class="fas fa-save"></i> Cadastrar';
    }
});


// --- Inicialização (Mantida) ---

document.addEventListener('DOMContentLoaded', async () => {
    const token = getToken();
    if (!token) return;

    editingMedicoId = getMedicoIdFromUrl();

    if (editingMedicoId) {
        const medico = await loadMedicoForEditing(editingMedicoId, token);
        if (medico) {
            await loadUnits(token, medico.unidade_id); 
            populateForm(medico);
        } else {
            await loadUnits(token);
        }
    } else {
        await loadUnits(token); 
    }
});

// Implementação da função de Logout no HTML (Mantida)
document.getElementById('logout-button').addEventListener('click', () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userName');
    alert('Sessão encerrada com sucesso.');
    window.location.href = '/login.html';
});