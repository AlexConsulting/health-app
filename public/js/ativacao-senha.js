// public/js/ativacao-senha.js

const API_BASE_URL = '/api/ativacoes'; // Seu prefixo de rota
let selectedSlot = null; // Armazena o slot atualmente selecionado

// Elementos DOM
const dataSelecao = document.getElementById('dataSelecao');
const slotsContainer = document.getElementById('slotsContainer');
const btnAgendar = document.getElementById('btnAgendar');
const statusMessage = document.getElementById('statusMessage');
const loadingIndicator = document.getElementById('loading');
const tituloPrincipal = document.querySelector('.container h2'); // Para personalização

// Campos Ocultos para Dados do Médico
const medicoIdInput = document.getElementById('medicoId');
const medicoTelefoneInput = document.getElementById('medicoTelefone');
const medicoCrmInput = document.getElementById('medicoCrm');
const tokenConviteInput = document.getElementById('tokenConvite'); // Onde guardamos o token da URL

// Configura a data mínima para hoje
const hoje = new Date().toISOString().split('T')[0];
dataSelecao.min = hoje;
dataSelecao.value = hoje;

// --- FUNÇÕES DE INTERFACE E UTILIDADE ---

function getUrlParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

function showLoading(show) {
    loadingIndicator.style.display = show ? 'inline-block' : 'none';
    // Só habilita o botão se o loading estiver falso E houver um slot selecionado
    btnAgendar.disabled = show || !selectedSlot; 
    dataSelecao.disabled = show; // Desabilita a seleção de data durante o carregamento
}

function updateStatus(message, type = 'info') {
    statusMessage.className = `alert alert-${type}`;
    statusMessage.textContent = message;
}

function renderSlots(janelas, data) {
    slotsContainer.innerHTML = '';
    selectedSlot = null;
    btnAgendar.disabled = true;

    if (janelas.length === 0) {
        updateStatus(`Nenhum horário disponível em ${data}. Tente outra data.`, 'warning');
        return;
    }

    updateStatus(`Horários disponíveis em ${data}. Clique em um slot para agendar.`, 'info');

    janelas.forEach(janela => {
        const slotDiv = document.createElement('div');
        slotDiv.className = 'col-4 col-md-3 btn btn-outline-secondary slot';
        slotDiv.textContent = janela.horario;
        slotDiv.setAttribute('data-data', janela.data);
        slotDiv.setAttribute('data-horario', `${janela.horario}:00`);
        
        // Lógica de seleção
        slotDiv.addEventListener('click', () => {
            // Desseleciona todos
            document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected', 'btn-primary'));
            
            // Seleciona o atual
            slotDiv.classList.add('selected', 'btn-primary');
            selectedSlot = {
                data: janela.data,
                horario: slotDiv.getAttribute('data-horario')
            };
            btnAgendar.disabled = false;
        });

        slotsContainer.appendChild(slotDiv);
    });
}

// --- FUNÇÕES DE BACKEND ---

/**
 * 1. Busca os dados do médico usando o token da URL.
 */
async function initializePage() {
    const token = getUrlParam('token');

    if (!token) {
        updateStatus("Erro: Convite inválido. O token de acesso não foi encontrado na URL.", 'danger');
        return;
    }

    tokenConviteInput.value = token;
    showLoading(true);
    updateStatus('Validando seu convite e carregando dados...', 'info');
    
    try {
        // Chamada para o novo endpoint de validação de token
        const response = await fetch(`${API_BASE_URL}/data/${token}`);
        const data = await response.json();

        if (response.ok) {
            // Preenche os campos ocultos com os dados do médico
            medicoIdInput.value = data.medicoId;
            medicoTelefoneInput.value = data.telefone;
            medicoCrmInput.value = data.crm;
            
            // Personaliza a interface
            tituloPrincipal.textContent = `Bem-vindo(a), Dr(a). ${data.nome.split(' ')[0]}!`;
            
            // Após carregar os dados, carrega os slots disponíveis
            await fetchSlots();
            
        } else {
            // Se o token for inválido, usado ou expirado
            updateStatus(`Erro na validação do convite: ${data.erro}.`, 'danger');
            slotsContainer.innerHTML = ''; // Limpa os slots
        }
    } catch (error) {
        updateStatus('Erro de conexão ao validar o convite. Verifique sua rede.', 'danger');
        console.error('Validation error:', error);
    } finally {
        showLoading(false);
    }
}


/**
 * 2. Busca os slots disponíveis para a data selecionada.
 */
async function fetchSlots() {
    const dataSelecionada = dataSelecao.value;
    if (!dataSelecionada) return;

    // Se a página não foi inicializada com os dados do médico, não prossegue
    if (!medicoIdInput.value) {
        updateStatus('Erro: Dados do médico não carregados. Recarregue a página com o link do convite.', 'danger');
        return;
    }

    showLoading(true);
    updateStatus('Buscando horários disponíveis...', 'info');

    try {
        const response = await fetch(`${API_BASE_URL}/janelas?data=${dataSelecionada}`);
        const data = await response.json();

        if (response.ok) {
            renderSlots(data.janelas, data.dataBusca);
        } else {
            updateStatus(`Erro ao buscar: ${data.erro}`, 'danger');
        }
    } catch (error) {
        updateStatus('Erro de conexão com o servidor.', 'danger');
        console.error('Fetch error:', error);
    } finally {
        showLoading(false);
    }
}

/**
 * 3. Envia o agendamento para o backend.
 */
async function handleAgendamento() {
    if (!selectedSlot) return;

    // Captura os dados AUTOCAPTURADOS
    const medicoId = medicoIdInput.value;
    const medicoTelefone = medicoTelefoneInput.value;
    const medicoCrm = medicoCrmInput.value;

    if (!medicoId || !medicoTelefone) {
        updateStatus('Erro: Informações do médico não carregadas. Impossível agendar.', 'danger');
        return;
    }

    showLoading(true);
    updateStatus('Confirmando seu agendamento...', 'primary');

    try {
        const response = await fetch(`${API_BASE_URL}/agendar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                medicoId: medicoId,
                dataAgendamento: selectedSlot.data,
                horarioAgendamento: selectedSlot.horario,
                telefoneMedico: medicoTelefone, // Enviado para notificação final
                crm: medicoCrm // Enviado para gerar o usuario_acesso
            })
        });

        const data = await response.json();

        if (response.ok) {
            updateStatus(data.mensagem, 'success');
            // Recarrega os slots para refletir o horário ocupado
            fetchSlots();
        } else if (response.status === 409) {
            updateStatus(data.erro, 'warning'); // Horário ocupado (Race condition)
            fetchSlots(); // Recarrega para que o slot desapareça
        } else {
            updateStatus(`Falha no agendamento: ${data.erro}`, 'danger');
        }
    } catch (error) {
        updateStatus('Erro de comunicação com o servidor durante o agendamento.', 'danger');
        console.error('Agendamento error:', error);
    } finally {
        showLoading(false);
    }
}

// --- EVENT LISTENERS E INICIALIZAÇÃO ---

// Busca slots ao mudar a data
dataSelecao.addEventListener('change', fetchSlots);

// Agendar ao clicar no botão
btnAgendar.addEventListener('click', handleAgendamento);

// Inicializa a página lendo o token e buscando os dados
document.addEventListener('DOMContentLoaded', initializePage);