// public/js/agendamentos.js

const logoutButton = document.getElementById('logout-button');
const agendamentosTableBody = document.getElementById('agendamentos-table-body');
const dataFilter = document.getElementById('filter-data');
const statusFilter = document.getElementById('filter-status');
const unidadeFilter = document.getElementById('filter-unidade');
const searchButton = document.getElementById('search-button');
const loteButton = document.getElementById('lote-button');

let allAgendamentosData = [];

// === Elementos e Lógica do MODAL DE INTEGRAÇÃO (Envio de Convite) ===
const agendamentoModal = document.getElementById('agendamento-modal');
const closeButton = agendamentoModal ? agendamentoModal.querySelector('.close-button') : null;
const individualForm = document.getElementById('individual-agendamento-form');

// === Elementos e Lógica do MODAL DE ATIVAÇÃO ===
const ativacaoModal = document.getElementById('ativacao-modal');
// ATENÇÃO: Verifique se o modal de ativação possui o botão de fechar com a classe '.close-button'
const ativacaoCloseButton = ativacaoModal ? ativacaoModal.querySelector('.close-button') : null;
const ativacaoForm = document.getElementById('ativacao-agendamento-form');

// ------------------------------------------------------------------
// 💡 FUNÇÃO: Gera a mensagem de convite para Integração
// ------------------------------------------------------------------
/**
 * Gera a mensagem padronizada do WhatsApp com o link de seleção para Integração.
 * @param {string} medicoNome - Nome do médico.
 * @param {string} agendamentoId - ID do agendamento PENDENTE.
 * @returns {string} Mensagem completa e codificada para o WhatsApp.
 */
function generateInvitationMessage(medicoNome, agendamentoId) {
    // O link deve apontar para a nova página de seleção pública
    const selectionLink = `${window.location.origin}/selecionar-data.html?id=${agendamentoId}`;
    
    // Datas disponíveis fixas (conforme padrão de comunicação)
    const fixedDates = 
        `\u{1F4C5} Dezembro/2025\n` +
        `01, 03, 05, 08, 10, 12, 15, 17, 19, 22\n\n` +
        `\u{1F4C5} Janeiro/2026\n` +
        `08, 09, 12, 15, 16, 19, 22, 23, 26, 29, 30`;

    // Uso de template literals com \n\n para espaçamento entre parágrafos.
    const rawMessage = 
        `Olá, Dr. ${medicoNome},\n\n` +
        `Tudo bem?\n\n` +
        `Meu nome é Jhulia, sou do setor de Qualidade da Performa Saúde. Primeiramente, seja muito bem-vindo ao time Performa Saúde! \u{1F60A}\n\n` + 
        `O motivo do meu contato é para agendarmos a sua integração on-line, um passo essencial para o início da sua agenda no Plena Saúde. Durante essa integração, serão apresentados todos os protocolos e rotinas internas da unidade e da Performa Saúde.\n\n` +
        `Essa reunião precisa ser realizada antes do seu primeiro plantão, preferencialmente com a maior antecedência possível, para que possamos testar o sistema e corrigir qualquer pendência de cadastro, caso necessário. As integrações são realizadas às segundas, quartas e sextas-feiras, sempre às 15h, diretamente com a Coordenadora de Qualidade, Hedine Costa.\n\n` +
        `Temos as seguintes datas disponíveis:\n` +
        `${fixedDates}\n\n` +
        `*Escolha sua data e confirme sua disponibilidade clicando aqui:* \n${selectionLink}\n\n` + 
        `Aguardamos sua confirmação.\n\n` +
        `Atenciosamente,\n` +
        `Equipe de Qualidade\n` +
        `Performa Saúde`;
    
    return encodeURIComponent(rawMessage);
}
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// 💡 NOVO: Função para gerar a mensagem de convite para Ativação
// ------------------------------------------------------------------
/**
 * Gera a mensagem padronizada do WhatsApp para o agendamento de Ativação.
 * @param {string} medicoNome - Nome do médico.
 * @param {string} agendamentoId - ID do agendamento.
 * @returns {string} Mensagem completa e codificada para o WhatsApp.
 */
function generateAtivacaoMessage(medicoNome, agendamentoId) {
    // O link deve apontar para a nova página de seleção pública de ativação
    const selectionLink = `${window.location.origin}/ativacao-data.html?id=${agendamentoId}`;
    
    const rawMessage = 
        `Olá, Dr. ${medicoNome},\n\n` +
        `Tudo bem? Meu nome é Juhlia, sou do setor de Qualidade da Performa Saúde.\n\n` +
        `Estamos entrando em contato para agendar sua *Ativação de Senha Assistida* do sistema Plena Saúde, um passo essencial para você iniciar suas atividades. \n\n` +
        `As ativações são realizadas de Segunda a Sexta, no horário das 14h às 16h.\n\n` +
        `*Clique no link abaixo para escolher o melhor dia e horário para a sua ativação:* \n${selectionLink}\n\n` +
        `Aguardamos sua confirmação.\n\n` +
        `Atenciosamente,\n` +
        `Equipe de Qualidade\n` +
        `Performa Saúde`;
    
    return encodeURIComponent(rawMessage);
}
// ------------------------------------------------------------------


/**
 * Abre o modal de Integração (Envio de Convite).
 * @param {object} data - Dados do agendamento (id, medico_nome, unidade_nome, pals, acls, medico_telefone).
 */
function openModal(data) {
    if (!agendamentoModal) {
        console.error('Modal de agendamento de integração não encontrado.');
        return;
    }

    // Preenche os campos de identificação
    document.getElementById('medico-telefone-modal').value = data.medico_telefone || 'N/A';
    document.getElementById('agendamento-id-modal').value = data.id; 
    document.getElementById('medico-nome-modal').value = data.medico_nome;
    document.getElementById('unidade-nome-modal').value = data.unidade_nome;
    
    // Preenche as certificações
    document.getElementById('pals-modal').checked = data.pals || false;
    document.getElementById('acls-modal').checked = data.acls || false;
    
    agendamentoModal.style.display = 'block';
}

/**
 * Abre o modal de Agendamento de Ativação (Envio de Convite).
 * @param {object} data - Dados do agendamento (id, medico_nome, unidade_nome, medico_telefone).
 */
function openAtivacaoModal(data) {
    if (!ativacaoModal) {
        console.error('Modal de ativação não encontrado.');
        return;
    }

    document.getElementById('ativacao-id-modal').value = data.id;
    document.getElementById('ativacao-medico-nome-modal').value = data.medico_nome;
    document.getElementById('ativacao-unidade-nome-modal').value = data.unidade_nome;
    document.getElementById('ativacao-medico-telefone-modal').value = data.medico_telefone || 'N/A';
    
    ativacaoModal.style.display = 'block';
}

if (closeButton) {
    closeButton.onclick = function() {
        agendamentoModal.style.display = 'none';
    }
}

if (ativacaoCloseButton) {
    ativacaoCloseButton.onclick = function() {
        ativacaoModal.style.display = 'none';
    }
}


window.onclick = function(event) {
    if (agendamentoModal && event.target === agendamentoModal) {
        agendamentoModal.style.display = 'none';
    }
    if (ativacaoModal && event.target === ativacaoModal) {
        ativacaoModal.style.display = 'none';
    }
}
// === FIM: Lógica dos Modais ===


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
    document.getElementById('welcome-message').textContent = `Olá, ${userName}`;
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
    const date = new Date(isoString);
    if (isNaN(date)) return 'N/A'; 
    return date.toLocaleDateString('pt-BR');
}

/**
 * Retorna o HTML formatado para o status do agendamento, incluindo novos status.
 * @param {string} status - O status do agendamento.
 * @returns {string} HTML com o badge de status.
 */
function formatStatus(status) {
    switch (status) {
        // Status do Meet de Integração (Fluxo Inicial)
        case 'PENDENTE': return '<span class="status-badge status-pending">Pendente</span>';
        case 'CONVITE_ENVIADO': return '<span class="status-badge status-sent">Convite Enviado</span>';
        case 'PRE_AGENDADO': return '<span class="status-badge status-pre-scheduled">Pré-Agendado</span>';
        case 'AGENDADO': return '<span class="status-badge status-scheduled">Agendado</span>';
        case 'CONFIRMADO': return '<span class="status-badge status-confirmed">Confirmado</span>';
        case 'REALIZADO': return '<span class="status-badge status-completed">Realizado (Integração)</span>'; // Adicionado "(Integração)" para clareza
        
        // =========================================================
        // 💡 NOVOS STATUS DO MEET DE ATIVAÇÃO (Obrigatórios)
        // =========================================================
        
        // 1. Sinaliza que a Integração acabou e o ciclo de Ativação começou
        case 'AGENDAMENTO_ATIVACAO_PENDENTE': return '<span class="status-badge status-activation-pending">Ativação Pendente</span>'; 

        // 2. Convite de Ativação enviado (Médico pode agendar)
        case 'ATIVACAO_ENVIADA': return '<span class="status-badge status-sent-ativacao">Convite Enviado (Ativ.)</span>';
        
        // 3. Médico escolheu a data, aguardando confirmação do Admin
        case 'ATIVACAO_PRE_AGENDADA': return '<span class="status-badge status-activation-pre-scheduled">Ativação Pré-Agendada</span>'; 
        
        // 4. Admin confirmou a data do Meet de Ativação
        case 'ATIVACAO_AGENDADA': return '<span class="status-badge status-scheduled-ativacao">Ativação Agendada</span>';
        
        // 5. Meet de Ativação realizado (Fim do processo)
        case 'ATIVACAO_REALIZADA': return '<span class="status-badge status-completed-ativacao">Ativação Realizada</span>';
        
        // =========================================================
        
        case 'CANCELADO': return '<span class="status-badge status-cancelled">Cancelado</span>';
        default: return status;
    }
}

// ------------------------------------------------------------------
// FUNÇÃO: Confirmação Final de Agendamento (PRE_AGENDADO -> AGENDADO)
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
            // 1. Obtém o link de confirmação do AGENDAMENTO (que o backend gera)
            const confirmationLink = result.confirmationLink;
            const telefoneLimpo = medicoTelefone.replace(/[\s-()]/g, '');
            
            // 2. Monta a mensagem final para o WhatsApp (AGENDADO)
            const whatsappMessage = `Olá, Dr(a) ${medicoNome}!\n\nSeu treinamento foi *AGENDADO* para o dia ${dataFinal} às ${horarioFinal}h.\n\nPor favor, confirme a presença neste link: ${confirmationLink}`;
            const whatsappUrl = `https://wa.me/55${telefoneLimpo}?text=${encodeURIComponent(whatsappMessage)}`;
            
            // 3. Abre o WhatsApp e recarrega a lista
            window.open(whatsappUrl, '_blank');
            showMessage(`Agendamento finalizado para ${dataFinal} às ${horarioFinal}. WhatsApp aberto para o envio do link de confirmação final.`, 'success');
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
            // Assumimos que o backend retorna { unidades: [...] }
            const units = result.unidades || []; 
            units.forEach(unit => {
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
 * (Corrigido para evitar o erro de lista vazia)
 */
async function loadAgendamentos() {
    const token = getToken();
    if (!token) return;

    const date = dataFilter.value;
    const status = statusFilter.value;
    const unitId = unidadeFilter.value;
    
    // Constrói a query string com os filtros
    let endpoint = `/api/agendamentos?`; 
    if (date) endpoint += `date=${date}&`;
    if (status) endpoint += `status=${status}&`;
    if (unitId) endpoint += `unitId=${unitId}&`;
    
    // Remove o '&' final se houver
    if (endpoint.endsWith('&')) {
        endpoint = endpoint.slice(0, -1);
    }
    
    try {
        const response = await fetch(endpoint, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const result = await response.json();

        if (response.ok) {
            // CORREÇÃO: Trata se o backend retorna { agendamentos: [...] } ou o array direto
            let dataList = result.agendamentos;
            if (!dataList && Array.isArray(result)) {
                dataList = result;
            }
            
            allAgendamentosData = Array.isArray(dataList) ? dataList : [];
            renderAgendamentosTable(allAgendamentosData);
        } else if (response.status === 401) {
            getToken(); // Tenta renovar ou redirecionar
        } else {
            showMessage(result.erro || 'Erro ao carregar agendamentos.', 'error');
            renderAgendamentosTable([]); // Limpa a tabela em caso de erro
        }
    } catch (error) {
        console.error('Erro na requisição de agendamentos:', error);
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
        // Colspan ajustado para 7 (Data/Hora, Médico, Telefone, Unidade, Detalhes, Status, Ações)
        agendamentosTableBody.innerHTML = `<tr><td colspan="7" class="placeholder-text" style="text-align: center; padding: 20px;">Nenhum treinamento encontrado com os filtros aplicados.</td></tr>`;
        return;
    }

    agendamentos.forEach(agendamento => {
        const row = document.createElement('tr');
        
        // --- Condições de Exibição de Botões (Integração) ---
        const isPendente = agendamento.status === 'PENDENTE';
        const isConviteEnviado = agendamento.status === 'CONVITE_ENVIADO'; 
        const isPreAgendado = agendamento.status === 'PRE_AGENDADO'; 
        const isAgendadoOuConfirmado = agendamento.status === 'AGENDADO' || agendamento.status === 'CONFIRMADO';
        
        // --- Condições de Exibição de Botões (Ativação) ---
        // 💡 CORRIGIDO: Botão de Ativação aparece quando a Integração está REALIZADA
        const isAptoParaAtivacao = agendamento.status === 'REALIZADO';
        const isAtivacaoAgendada = agendamento.status === 'ATIVACAO_AGENDADA';

        // Ações gerais
        // Um agendamento é cancelável a menos que já esteja REALIZADO (Integração ou Ativação)
        const isCancelavel = agendamento.status !== 'CANCELADO' && agendamento.status !== 'REALIZADO' && agendamento.status !== 'ATIVACAO_REALIZADA';
        
        // Data e Horário
        // Tenta data de ativação, depois data preferencial, depois data de integração
        const displayDate = formatDate(agendamento.data_ativacao || agendamento.data_preferencial || agendamento.data_integracao); 
        const displayTime = agendamento.horario_ativacao || agendamento.horario_preferencial || agendamento.horario || '';


        row.innerHTML = `
            <td>${displayDate} ${displayTime}</td>
            <td>${agendamento.medico_nome || 'N/A'}</td>
            <td>${agendamento.medico_telefone || 'N/A'}</td> 
            <td>${agendamento.unidade_nome || 'N/A'}</td>
            <td>${agendamento.pals ? 'PALS' : ''} ${agendamento.acls ? 'ACLS' : ''}</td>
            <td>${formatStatus(agendamento.status)}</td>
            <td>
                ${isPendente ? 
                    // BOTÃO: Enviar Convite (abre modal Integração)
                    `<button class="btn-icon btn-schedule-individual" title="Enviar Convite (WhatsApp)" 
                        data-id="${agendamento.id}"
                        data-medico-nome="${agendamento.medico_nome}"
                        data-unidade-nome="${agendamento.unidade_nome}"
                        data-medico-telefone="${agendamento.medico_telefone || ''}" 
                        data-pals="${agendamento.pals}"
                        data-acls="${agendamento.acls}">
                        <i class="fab fa-whatsapp"></i> 
                    </button>` : ''}

                ${isAptoParaAtivacao ?
                    // 💡 BOTÃO NOVO: Enviar Convite de Ativação (Aparece quando status é REALIZADO)
                    `<button class="btn-icon btn-schedule-ativacao" title="Agendar Ativação de Senha" 
                        data-id="${agendamento.id}"
                        data-medico-nome="${agendamento.medico_nome}"
                        data-unidade-nome="${agendamento.unidade_nome}"
                        data-medico-telefone="${agendamento.medico_telefone || ''}">
                        <i class="fas fa-key"></i> 
                    </button>` : ''}

                ${isConviteEnviado ?
                    // Ação de copiar link (Integracao)
                    `<button class="btn-icon btn-copy-link" title="Copiar Link de Convite" onclick="copyConviteLink('${agendamento.id}')">
                        <i class="fas fa-copy"></i> 
                    </button>` : ''}

                ${isPreAgendado ?
                    // BOTÃO: Confirmar Agendamento Final (Integracao)
                    `<button class="btn-icon btn-confirm-final" title="Confirmar Agendamento Final" 
                        data-id="${agendamento.id}"
                        data-medico-nome="${agendamento.medico_nome}" 
                        data-medico-telefone="${agendamento.medico_telefone || ''}"
                        data-data-final="${displayDate}"
                        data-horario-final="${displayTime}">
                        <i class="fas fa-calendar-check"></i>
                    </button>` : ''}

                ${isAgendadoOuConfirmado || isAtivacaoAgendada ? 
                    // Botão Marcar como Realizado (Comum para Integração e Ativação)
                    `<button class="btn-icon btn-realizar" title="Marcar como Realizado" data-id="${agendamento.id}" data-status="${isAtivacaoAgendada ? 'ATIVACAO_REALIZADA' : 'REALIZADO'}">
                        <i class="fas fa-check-circle"></i>
                    </button>` : ''}
                    
                ${isCancelavel ? 
                    // Botão Cancelar Treinamento (Existente)
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
// FUNÇÃO AUXILIAR: Copiar Link de Convite (para status CONVITE_ENVIADO)
// ------------------------------------------------------------------
/**
 * Copia o link público de seleção de data para a área de transferência.
 * @param {string} agendamentoId - ID do agendamento.
 */
function copyConviteLink(agendamentoId) {
    // O link do convite deve ser para a página selecionar-data.html
    const conviteLink = `${window.location.origin}/selecionar-data.html?id=${agendamentoId}`;
    
    // Verifica se a API Clipboard está disponível (requer HTTPS ou localhost)
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(conviteLink).then(() => {
            showMessage('Link do convite copiado para a área de transferência!', 'success');
        }).catch(err => {
            console.error('Erro ao copiar link via API Clipboard: ', err);
            showMessage('Erro ao copiar link. Copie manualmente: ' + conviteLink, 'error');
        });
    } else {
        // Fallback para navegadores mais antigos ou ambientes sem permissão
        const tempInput = document.createElement('input');
        tempInput.value = conviteLink;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        showMessage('Link do convite copiado para a área de transferência (Fallback)!', 'success');
    }
}


// --- Lógica de Ações e Event Listeners ---

function addEventListenersToActions() {
    const token = getToken();
    if (!token) return;

    // Listener para o botão de Enviar Convite (Abre o Modal Integração)
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
    
    // 💡 NOVO: Listener para o botão de Enviar Convite de Ativação (Abre o Modal Ativação)
    document.querySelectorAll('.btn-schedule-ativacao').forEach(button => {
        button.addEventListener('click', (e) => {
            const agendamentoData = {
                id: e.currentTarget.dataset.id, 
                medico_nome: e.currentTarget.dataset.medicoNome,
                unidade_nome: e.currentTarget.dataset.unidadeNome,
                medico_telefone: e.currentTarget.dataset.medicoTelefone, 
            };
            openAtivacaoModal(agendamentoData);
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


// Submit do Formulário Individual (ENVIA CONVITE de Integração)
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
                body: JSON.stringify({ status: 'CONVITE_ENVIADO' }) // NOVO STATUS
            });

            const result = await response.json();

            if (response.ok) {
                showMessage(result.mensagem || 'Status atualizado para CONVITE_ENVIADO. Abrindo WhatsApp...', 'success');
                
                // 2. Lógica para Geração e Abertura do link do WhatsApp
                const telefoneLimpo = medicoTelefone.replace(/[\s-()]/g, ''); 
                const mensagem = generateInvitationMessage(medicoNome, agendamento_id);
                window.open(`https://wa.me/55${telefoneLimpo}?text=${mensagem}`, '_blank'); // Abre WhatsApp
                
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


// 💡 NOVO: Submit do Formulário de Ativação (ENVIA CONVITE de Ativação)
if (ativacaoForm) {
    ativacaoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const token = getToken();
        if (!token) return;

        const agendamento_id = document.getElementById('ativacao-id-modal').value; 
        const medicoNome = document.getElementById('ativacao-medico-nome-modal').value;
        const medicoTelefone = document.getElementById('ativacao-medico-telefone-modal').value;
        
        const submitButton = document.getElementById('submit-ativacao-individual');
        submitButton.disabled = true;

        try {
            // 1. Atualiza o status do agendamento de REALIZADO para ATIVACAO_ENVIADA
            const response = await fetch(`/api/agendamentos/${agendamento_id}/status`, {
                method: 'PUT', 
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: 'ATIVACAO_ENVIADA' }) // NOVO STATUS
            });

            const result = await response.json();

            if (response.ok) {
                showMessage(result.mensagem || 'Status atualizado para ATIVACAO_ENVIADA. Abrindo WhatsApp...', 'success');
                
                // 2. Lógica para Geração e Abertura do link do WhatsApp
                const telefoneLimpo = medicoTelefone.replace(/[\s-()]/g, ''); 
                const mensagem = generateAtivacaoMessage(medicoNome, agendamento_id);
                window.open(`https://wa.me/55${telefoneLimpo}?text=${mensagem}`, '_blank'); // Abre WhatsApp
                
                // Fecha o modal e recarrega a lista
                ativacaoModal.style.display = 'none';
                setTimeout(loadAgendamentos, 1500); 
                
            } else {
                showMessage(result.erro || 'Erro ao atualizar status e enviar link de ativação.', 'error');
            }

        } catch (error) {
            console.error('Erro no envio do convite de ativação:', error);
            showMessage('Erro de conexão com o servidor.', 'error');
        } finally {
            submitButton.disabled = false;
        }
    });
}


// --- Inicialização e Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    // Adicionado verificação de token logo na inicialização para proteger a página
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