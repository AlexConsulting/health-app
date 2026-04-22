// public/js/agendamentos.js

const logoutButton = document.getElementById('logout-button');
const agendamentosTableBody = document.getElementById('agendamentos-table-body');
const dataFilter = document.getElementById('filter-data');
const statusFilter = document.getElementById('filter-status');
const unidadeFilter = document.getElementById('filter-unidade');
const searchButton = document.getElementById('search-button');
const loteButton = document.getElementById('lote-button');

let allAgendamentosData = [];

// === Elementos e Lógica do NOVO MODAL (Envio de Convite) ===
const agendamentoModal = document.getElementById('agendamento-modal');
const closeButton = agendamentoModal ? agendamentoModal.querySelector('.close-button') : null;
const individualForm = document.getElementById('individual-agendamento-form');


// ------------------------------------------------------------------
// 💡 CORRIGIDO: Função para gerar o corpo da mensagem de convite no WhatsApp
// ------------------------------------------------------------------
/**
 * Gera a mensagem padronizada do WhatsApp com o link de seleção.
 * @param {string} medicoNome - Nome do médico.
 * @param {string} agendamentoId - ID do agendamento PENDENTE.
 * @returns {string} Mensagem completa e codificada para o WhatsApp.
 */
function generateInvitationMessage(medicoNome, agendamentoId) {
    // O link deve apontar para a nova página de seleção pública
    const selectionLink = `${window.location.origin}/selecionar-data.html?id=${agendamentoId}`;
    
    // Uso de template literals com \n\n para espaçamento entre parágrafos.
    const rawMessage = 
        `Olá, Dr. ${medicoNome},\n\n` +
        `Tudo bem?\n\n` +
        `Somos do setor de Qualidade da Performa Saúde. Primeiramente, seja muito bem-vindo ao time Performa Saúde! \u{1F60A}\n\n` + 
        `O motivo do meu contato é para agendarmos a sua integração on-line, um passo essencial para o início da sua agenda no Plena Saúde. Durante essa integração, serão apresentados todos os protocolos e rotinas internas da unidade e da Performa Saúde.\n\n` +
        `Essa reunião precisa ser realizada antes do seu primeiro plantão, preferencialmente com a maior antecedência possível, para que possamos testar o sistema e corrigir qualquer pendência de cadastro, caso necessário.\n\n` +
        `As integrações são realizadas sempre às *segundas, quartas e sextas-feiras*, das 13h às 17h, diretamente com a Coordenadora de Qualidade, Hedine Costa.\n\n` +
        `*Escolha sua data e confirme sua disponibilidade clicando no link abaixo:* \n${selectionLink}\n\n` + 
        `Aguardamos sua confirmação.\n\n` +
        `Atenciosamente,\n` +
        `Equipe de Qualidade\n` +
        `Performa Saúde`;
    
    return encodeURIComponent(rawMessage);
}
// ------------------------------------------------------------------

// 💡 FUNÇÃO ADICIONADA PARA O MEET
function generateMeetMessage(medicoNome, data, hora) {
    const meetLink = "https://meet.google.com/xxx-xxxx-xxx"; 
    const rawMessage = `Olá, Dr. ${medicoNome}!\n\nConfirmamos sua integração para o dia *${data}* às *${hora}*.\n\nSegue o link da reunião (Google Meet):\n${meetLink}\n\nAtenciosamente, Equipe Performa Saúde.`;
    return encodeURIComponent(rawMessage);
}


/**
 * Abre o modal e preenche os dados do agendamento PENDENTE.
 * O modal agora é usado para confirmar os dados antes de ENVIAR O CONVITE.
 * @param {object} data - Dados do agendamento (id, medico_nome, unidade_nome, pals, acls, medico_telefone).
 */
function openModal(data) {
    if (!agendamentoModal) {
        console.error('Modal de agendamento não encontrado.');
        return;
    }

    console.log('Dados carregados para o modal (Envio de Convite):', data);
    
    // Preenche os campos de identificação
    document.getElementById('medico-telefone-modal').value = data.medico_telefone || 'N/A';
    document.getElementById('agendamento-id-modal').value = data.id; 
    document.getElementById('medico-nome-modal').value = data.medico_nome;
    document.getElementById('unidade-nome-modal').value = data.unidade_nome;
    
    // Preenche as certificações
    document.getElementById('pals-modal').checked = data.pals || false;
    document.getElementById('acls-modal').checked = data.acls || false;
    
    // Configuração para ocultar/desabilitar data/hora (Médico escolhe)
    const dataIntegracaoInput = document.getElementById('data-integracao-modal');
    const horarioInput = document.getElementById('horario-modal');

    if (dataIntegracaoInput) dataIntegracaoInput.required = false;
    if (horarioInput) horarioInput.required = false;

    agendamentoModal.style.display = 'block';
}

if (closeButton) {
    closeButton.onclick = function() {
        agendamentoModal.style.display = 'none';
    }
}

window.onclick = function(event) {
    if (agendamentoModal && event.target === agendamentoModal) {
        agendamentoModal.style.display = 'none';
    }
}
// === FIM: Lógica do NOVO MODAL (Envio de Convite) ===


// --- Funções de Utilitário ---

/**
 * Obtém o token JWT e o nome do usuário, validando a sessão.
 * @returns {string|null} O token ou null se inválido/expirado.
 */
function getToken() {
    const token = localStorage.getItem('userToken');
    const userName = localStorage.getItem('userName');

    if (!token || !userName) {
        // Alerta e redireciona para login se a sessão for inválida
        alert('Sessão inválida ou expirada. Faça o login novamente.');
        window.location.href = '/login.html';
        return null;
    }
    const welcomeMsg = document.getElementById('welcome-message');
    if (welcomeMsg) welcomeMsg.textContent = `Olá, ${userName}`;
    return token;
}

/**
 * Exibe uma mensagem temporária na área de listagem.
 * @param {string} message - A mensagem a ser exibida.
 * @param {string} type - O tipo de mensagem ('success', 'error', 'warning').
 */
function showMessage(message, type = 'success') {
    const messageArea = document.querySelector('.list-container .card'); 
    let msgDiv = document.getElementById('temp-message-div');
    if (!msgDiv) {
        msgDiv = document.createElement('div');
        msgDiv.id = 'temp-message-div';
        if (messageArea) {
            messageArea.prepend(msgDiv); 
        } else {
            console.error('Área de mensagem não encontrada. Exibindo alerta.');
            alert(message);
            return;
        }
    }
    msgDiv.textContent = message;
    msgDiv.className = `message-area message-${type}`;
    setTimeout(() => {
        msgDiv.textContent = '';
        msgDiv.className = 'message-area';
    }, 5000); 
}

/**
 * Formata uma string ISO de data para 'dd/mm/aaaa'.
 * @param {string} isoString - Data no formato ISO.
 * @returns {string} Data formatada ou 'N/A'.
 */
function formatDate(isoString) {
    if (!isoString) return 'N/A';
    // 💡 AJUSTE DE FUSO: Forçamos UTC para evitar que 00:00:00 recue um dia no Brasil
    const date = new Date(isoString);
    if (isNaN(date)) return 'N/A'; 
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

/**
 * Retorna o HTML formatado para o status do agendamento, incluindo novos status.
 * @param {string} status - O status do agendamento.
 * @returns {string} HTML com o badge de status.
 */
function formatStatus(status) {
    switch (status) {
        case 'PENDENTE': return '<span class="status-badge status-pending">Pendente</span>';
        case 'CONVITE_ENVIADO': return '<span class="status-badge status-sent">Convite Enviado</span>';
        case 'PRE_AGENDADO': return '<span class="status-badge status-pre-scheduled">Pré-Agendado</span>';
        case 'AGENDADO': return '<span class="status-badge status-scheduled">Agendado</span>';
        case 'CONFIRMADO': return '<span class="status-badge status-confirmed">Confirmado</span>';
        case 'REALIZADO': return '<span class="status-badge status-completed">Realizado</span>';
        case 'CANCELADO': return '<span class="status-badge status-cancelled">Cancelado</span>';
        default: return status;
    }
}

// ------------------------------------------------------------------
// 💡 FUNÇÃO ATUALIZADA: Confirmação Final de Agendamento (AGORA INFORMATIVA)
// ------------------------------------------------------------------
/**
 * Atualiza o status do agendamento de PRE_AGENDADO para AGENDADO (Confirmação Final).
 * @param {string} id - ID do agendamento.
 * @param {string} token - Token JWT de autenticação.
 * @param {string} medicoNome - Nome do médico para a mensagem do WhatsApp.
 * @param {string} medicoTelefone - Telefone do médico para a mensagem do WhatsApp.
 * @param {string} dataFinal - Data final formatada para a mensagem.
 * @param {string} horarioFinal - Horário final formatado para a mensagem.
 */
async function confirmarAgendamentoFinal(id, token, medicoNome, medicoTelefone, dataFinal, horarioFinal) {
    
    // Confirmação com dados para melhor UX
    if (!confirm(`Tem certeza que deseja confirmar o agendamento final para ${medicoNome} no dia ${dataFinal} às ${horarioFinal}?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/agendamentos/confirmar-final/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (response.ok) {
            const telefoneLimpo = medicoTelefone.replace(/[\s-()]/g, '');
            
            const whatsappMessage = `Olá, Dr(a) ${medicoNome}!\n\nSeu treinamento foi *CONFIRMADO* com sucesso para o dia ${dataFinal} às ${horarioFinal}h.\n\nNão é necessário realizar nenhuma ação adicional. Ficamos à disposição!\n\nAtenciosamente,\nEquipe de Qualidade - Performa Saúde`;
            
            const whatsappUrl = `https://wa.me/55${telefoneLimpo}?text=${encodeURIComponent(whatsappMessage)}`;
            
            window.open(whatsappUrl, '_blank');
            showMessage(`Agendamento finalizado para ${dataFinal} às ${horarioFinal}. Comprovante enviado via WhatsApp.`, 'success');
            loadAgendamentos(); 
        } else {
            showMessage(result.erro || 'Erro ao confirmar agendamento final.', 'error');
        }
    } catch (error) {
        console.error('Erro na requisição de confirmação final:', error);
        showMessage('Erro de conexão com o servidor.', 'error');
    }
}


// --- Carregamento e Renderização ---

/**
 * Carrega a lista de unidades e preenche o filtro de unidade.
 */
async function loadUnitsForFilter() {
    const token = getToken();
    if (!token) return;

    try {
        const response = await fetch('/api/unidades', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();

        if (response.ok) {
            unidadeFilter.innerHTML = '<option value="">Todas as Unidades</option>';
            result.unidades.forEach(unit => {
                const option = document.createElement('option');
                option.value = unit.id;
                option.textContent = unit.nome;
                unidadeFilter.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar unidades:', error);
    }
}

/**
 * Carrega a lista de agendamentos com base nos filtros.
 */
async function loadAgendamentos() {
    const token = getToken();
    if (!token) return;

    const date = dataFilter.value;
    const status = statusFilter.value;
    const unitId = unidadeFilter.value;
    
    // Constrói a query string com os filtros
    let endpoint = `/api/agendamentos`; 
    const queryParams = [];

    if (date) queryParams.push(`date=${date}`);
    if (status) queryParams.push(`status=${status}`);
    if (unitId) queryParams.push(`unitId=${unitId}`);

    // 💡 MUDANÇA AQUI: Adiciona '?' somente se houver parâmetros
    if (queryParams.length > 0) {
        endpoint += `?${queryParams.join('&')}`;
    }
    
    try {
        const response = await fetch(endpoint, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const result = await response.json();

        if (response.ok) {
            allAgendamentosData = result.agendamentos || [];
            renderAgendamentosTable(allAgendamentosData);
        } else if (response.status === 401) {
            getToken(); // Tenta renovar ou redirecionar
        } else {
            console.error(`Erro ${response.status} ao carregar agendamentos. Endpoint: ${endpoint}`, result.erro);
            showMessage(result.erro || 'Erro ao carregar agendamentos. Verifique o console para detalhes.', 'error');
            renderAgendamentosTable([]); // Limpa a tabela em caso de erro
        }
    } catch (error) {
        console.error('Erro na requisição de agendamentos (possível erro de rede/servidor):', error);
        showMessage('Erro de conexão com o servidor.', 'error');
    }
}

/**
 * Renderiza os dados dos agendamentos na tabela.
 * @param {Array<object>} agendamentos - Lista de objetos de agendamento.
 */
function renderAgendamentosTable(agendamentos) {
    agendamentosTableBody.innerHTML = ''; 

    if (agendamentos.length === 0) {
        agendamentosTableBody.innerHTML = `<tr><td colspan="7" class="placeholder-text" style="text-align: center; padding: 20px;">Nenhum treinamento encontrado com os filtros aplicados.</td></tr>`;
        return;
    }

    agendamentos.forEach(agendamento => {
        const row = document.createElement('tr');
        
        // Determina a exibição dos botões
        const isPendente = agendamento.status === 'PENDENTE';
        const isConviteEnviado = agendamento.status === 'CONVITE_ENVIADO'; 
        const isPreAgendado = agendamento.status === 'PRE_AGENDADO'; 
        // 💡 AJUSTE DE LÓGICA: Garantindo que status AGENDADO também mostre o botão de Realizado
        const isAgendadoOuConfirmado = agendamento.status === 'AGENDADO' || agendamento.status === 'CONFIRMADO';
        // 💡 AJUSTE DE LÓGICA: Garantindo que o botão Cancelar apareça para quem está AGENDADO
        const isCancelavel = agendamento.status !== 'CANCELADO' && agendamento.status !== 'REALIZADO';
        
        // Data e Horário: prioriza data_preferencial se PRE_AGENDADO, senão usa a data_integracao
        const displayDate = formatDate(agendamento.data_integracao || agendamento.data_preferencial); 
        const displayTime = agendamento.horario || agendamento.horario_preferencial || '';

        row.innerHTML = `
            <td>${displayDate} ${displayTime}</td>
            <td>${agendamento.medico_nome || 'N/A'}</td>
            <td>${agendamento.medico_telefone || 'N/A'}</td> 
            <td>${agendamento.unidade_nome || 'N/A'}</td>
            <td>${agendamento.pals ? 'PALS' : ''} ${agendamento.acls ? 'ACLS' : ''}</td>
            <td>${formatStatus(agendamento.status)}</td>
            <td>
                ${isPendente ? 
                    `<button class="btn-icon btn-schedule-individual" title="Enviar Convite (WhatsApp)" 
                        data-id="${agendamento.id}"
                        data-medico-nome="${agendamento.medico_nome}"
                        data-unidade-nome="${agendamento.unidade_nome}"
                        data-medico-telefone="${agendamento.medico_telefone || ''}" 
                        data-pals="${agendamento.pals}"
                        data-acls="${agendamento.acls}">
                        <i class="fab fa-whatsapp"></i> 
                    </button>` : ''}

                ${isConviteEnviado ?
                    `<button class="btn-icon btn-copy-link" title="Copiar Link de Convite" onclick="copyConviteLink('${agendamento.id}')">
                        <i class="fas fa-copy"></i> 
                    </button>
                    <button class="btn-icon btn-view-public" title="Simular Link do Médico" onclick="window.open('/selecionar-data.html?id=${agendamento.id}', '_blank')">
                        <i class="fas fa-eye" style="color: #007bff;"></i>
                    </button>` : ''}

                ${isPreAgendado ?
                    `<button class="btn-icon btn-confirm-final" title="Confirmar Agendamento Final" 
                        data-id="${agendamento.id}"
                        data-medico-nome="${agendamento.medico_nome}" 
                        data-medico-telefone="${agendamento.medico_telefone || ''}"
                        data-data-final="${displayDate}"
                        data-horario-final="${displayTime}">
                        <i class="fas fa-calendar-check"></i>
                    </button>` : ''}

                ${isAgendadoOuConfirmado ? 
                    `<button class="btn-icon btn-send-meet" title="Enviar Link do Meet" 
                        data-medico-nome="${agendamento.medico_nome}" 
                        data-medico-telefone="${agendamento.medico_telefone || ''}"
                        data-data="${displayDate}" 
                        data-hora="${displayTime}">
                        <i class="fas fa-video" style="color: #28a745;"></i>
                    </button>
                    <button class="btn-icon btn-realizar" title="Marcar como Realizado" data-id="${agendamento.id}" data-status="REALIZADO">
                        <i class="fas fa-check-circle"></i>
                    </button>` : ''}
                    
                ${isCancelavel ? 
                    `<button class="btn-icon btn-cancel" title="Cancelar Treinamento" data-id="${agendamento.id}" data-status="CANCELADO">
                        <i class="fas fa-times"></i>
                    </button>` : ''}
                
            </td>
        `;
        agendamentosTableBody.appendChild(row);
    });

    addEventListenersToActions();
}

// ------------------------------------------------------------------
// 💡 FUNÇÃO AUXILIAR: Copiar Link de Convite (para status CONVITE_ENVIADO)
// ------------------------------------------------------------------
/**
 * Copia o link público de seleção de data para a área de transferência.
 * @param {string} agendamentoId - ID do agendamento.
 */
function copyConviteLink(agendamentoId) {
    const conviteLink = `${window.location.origin}/selecionar-data.html?id=${agendamentoId}`;
    
    const tempInput = document.createElement('input');
    tempInput.value = conviteLink;
    document.body.appendChild(tempInput);
    tempInput.select();
    
    try {
        document.execCommand('copy');
        showMessage('Link do convite copiado para a área de transferência!', 'success');
    } catch (err) {
        console.error('Erro ao copiar link:', err);
        showMessage('Erro ao copiar link. Copie manualmente: ' + conviteLink, 'error');
    } finally {
        document.body.removeChild(tempInput);
    }
}


// --- Lógica de Ações e Event Listeners ---

function addEventListenersToActions() {
    const token = getToken();
    if (!token) return;

    // 💡 LISTENER DO MEET
    document.querySelectorAll('.btn-send-meet').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const d = e.currentTarget.dataset;
            const tel = d.medicoTelefone.replace(/[\s-()]/g, '');
            const msg = generateMeetMessage(d.medicoNome, d.data, d.hora);
            window.open(`https://wa.me/55${tel}?text=${msg}`, '_blank');
        });
    });

    // Listener para o botão de Enviar Convite (Abre o Modal)
    document.querySelectorAll('.btn-schedule-individual').forEach(button => {
        button.addEventListener('click', (e) => {
            const agendamentoData = {
                id: e.currentTarget.dataset.id, 
                medico_nome: e.currentTarget.dataset.medicoNome,
                unidade_nome: e.currentTarget.dataset.unidadeNome,
                medico_telefone: e.currentTarget.dataset.medicoTelefone, 
                pals: e.currentTarget.dataset.pals === 'true',
                acls: e.currentTarget.dataset.acls === 'true',
            };
            openModal(agendamentoData);
        });
    });
    
    // Listener para o botão de Confirmação Final (PRE_AGENDADO -> AGENDADO)
    document.querySelectorAll('.btn-confirm-final').forEach(button => {
        button.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            const medicoNome = e.currentTarget.dataset.medicoNome;
            const medicoTelefone = e.currentTarget.dataset.medicoTelefone;
            const dataFinal = e.currentTarget.dataset.dataFinal;
            const horarioFinal = e.currentTarget.dataset.horarioFinal;
            
            await confirmarAgendamentoFinal(id, token, medicoNome, medicoTelefone, dataFinal, horarioFinal);
        });
    });

    // Listener para os botões de Ação (Realizar/Cancelar)
    document.querySelectorAll('.btn-realizar, .btn-cancel').forEach(button => {
        button.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            const status = e.currentTarget.dataset.status;
            
            if (confirm(`Tem certeza que deseja alterar o status do agendamento ID ${id} para ${status}?`)) {
                await updateAgendamentoStatus(id, status, token);
            }
        });
    });
}

/**
 * Função para atualizar o status de um agendamento específico.
 * @param {string} id - ID do agendamento.
 * @param {string} status - Novo status.
 * @param {string} token - Token JWT de autenticação.
 */
async function updateAgendamentoStatus(id, status, token) {
    try {
        const response = await fetch(`/api/agendamentos/${id}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: status })
        });

        const result = await response.json();

        if (response.ok) {
            showMessage(result.mensagem, 'success');
            loadAgendamentos(); // Recarrega a lista
        } else {
            showMessage(result.erro || 'Erro ao atualizar status.', 'error');
        }
    } catch (error) {
        console.error('Erro na requisição de atualização de status:', error);
        showMessage('Erro de conexão com o servidor.', 'error');
    }
}


// Submit do Formulário Individual (ENVIA CONVITE)
if (individualForm) {
    individualForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const token = getToken();
        if (!token) return;

        const agendamento_id = document.getElementById('agendamento-id-modal').value; 
        const medicoNome = document.getElementById('medico-nome-modal').value;
        const medicoTelefone = document.getElementById('medico-telefone-modal').value;
        
        const submitButton = document.getElementById('submit-agendamento-individual');
        submitButton.disabled = true;

        try {
            // 1. Atualiza o status do agendamento de PENDENTE para CONVITE_ENVIADO
            const response = await fetch(`/api/agendamentos/${agendamento_id}/status`, {
                method: 'PUT', 
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: 'CONVITE_ENVIADO' }) 
            });

            const result = await response.json();

            if (response.ok) {
                showMessage(result.mensagem || 'Status atualizado para CONVITE_ENVIADO. Abrindo WhatsApp...', 'success');
                
                // 2. Lógica para Geração e Abertura do link do WhatsApp
                const telefoneLimpo = medicoTelefone.replace(/[\s-()]/g, ''); 
                const mensagem = generateInvitationMessage(medicoNome, agendamento_id);

                window.open(`https://wa.me/55${telefoneLimpo}?text=${mensagem}`, '_blank');
                
                // Fecha o modal e recarrega a lista
                agendamentoModal.style.display = 'none';
                setTimeout(loadAgendamentos, 1500); 
                
            } else {
                showMessage(result.erro || 'Erro ao atualizar status e enviar link.', 'error');
            }

        } catch (error) {
            console.error('Erro no envio do convite:', error);
            showMessage('Erro de conexão com o servidor.', 'error');
        } finally {
            submitButton.disabled = false;
        }
    });
}


// --- Inicialização e Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    const token = getToken(); 
    if (token) {
        loadUnitsForFilter();
        loadAgendamentos();
    }
});

if (searchButton) searchButton.addEventListener('click', loadAgendamentos);
if (dataFilter) dataFilter.addEventListener('change', loadAgendamentos);
if (statusFilter) statusFilter.addEventListener('change', loadAgendamentos);
if (unidadeFilter) unidadeFilter.addEventListener('change', loadAgendamentos);

// Listener de Logout
if (logoutButton) {
    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('userToken');
        localStorage.removeItem('userName');
        alert('Sessão encerrada com sucesso.');
        window.location.href = '/login.html';
    });
}