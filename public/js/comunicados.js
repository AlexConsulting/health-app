// public/js/comunicados.js

document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Script de Comunicados iniciado.");

    // Variáveis globais para elementos DOM
    const comunicadoForm = document.getElementById('comunicado-form');
    const enviarButton = document.getElementById('enviar-button');
    const statusMessage = document.getElementById('status-message');
    const comunicadosStatusTableBody = document.getElementById('comunicados-status-table-body');
    const publicoAlvoSelect = document.getElementById('publico-alvo');
    
    // Variáveis de Progresso
    const progressWrapper = document.getElementById('progress-wrapper');
    const progressBar = document.getElementById('progress-bar');
    
    // Referência Específica (Empresa/Unidade)
    const referenciaGroupDiv = document.getElementById('referencia-group');
    const referenciaSelect = document.getElementById('referencia-select');
    const referenciaLabel = document.getElementById('referencia-label');
    const referenciaTypeInput = document.getElementById('referencia-type');
    
    // Confirmação TODOS
    const todosMedicosConfirmDiv = document.getElementById('todos-medicos-confirm'); 
    const confirmarTodosCheckbox = document.getElementById('confirmar-todos');

    // --- FUNÇÕES AUXILIARES ---

    /**
     * CORREÇÃO: Busca o token usando a chave 'token' (padronizada com login.js)
     */
    function getAuthHeader() {
        const token = localStorage.getItem('userToken'); // Alterado de 'userToken' para 'token'
        if (!token || token === 'undefined' || token === 'null') {
            console.warn("⚠️ Token não encontrado ou inválido no LocalStorage.");
            return {};
        }
        return { 'Authorization': `Bearer ${token}` };
    }

    function showLocalMessage(text, type) {
        console.log(`📢 Mensagem [${type}]: ${text}`);
        if (!statusMessage) {
            alert(text);
            return;
        }
        statusMessage.textContent = text;
        statusMessage.className = `message ${type}`; 
        
        // Remove a mensagem após 5 segundos
        setTimeout(() => { 
            statusMessage.textContent = ''; 
            statusMessage.className = 'message';
        }, 5000);
    }

    // --- FUNÇÕES DE INTERFACE ---

    function updateProgressBar(percent, text) {
        if (!progressWrapper || !progressBar) return;
        progressWrapper.style.display = 'block';
        progressBar.style.width = `${percent}%`;
        progressBar.textContent = text || `${percent}%`;
        
        if (percent >= 100) {
            progressBar.style.backgroundColor = '#28a745';
            setTimeout(() => { 
                progressWrapper.style.display = 'none';
                progressBar.style.width = '0%';
                progressBar.style.backgroundColor = ''; // Reset cor
            }, 5000);
        }
    }

    // --- LÓGICA DE RASTREAMENTO (POLLING) ---

    async function trackProgress(comunicadoId) {
        console.log(`🔍 Iniciando rastreamento do comunicado: ${comunicadoId}`);
        
        const interval = setInterval(async () => {
            try {
                const response = await fetch(`/api/comunicados/detalhes/${comunicadoId}`, {
                    headers: getAuthHeader()
                });
                
                if (response.status === 401) {
                    console.error("🚫 Sessão expirada durante o rastreamento.");
                    clearInterval(interval);
                    return;
                }
                
                const logs = await response.json();
                if (!Array.isArray(logs)) return;
                
                const total = logs.length;
                if (total === 0) {
                    updateProgressBar(5, "Iniciando fila...");
                    return;
                }

                const processados = logs.filter(l => l.status_envio === 'ENVIADO' || l.status_envio === 'ERRO').length;
                const percentual = Math.round((processados / total) * 100);

                updateProgressBar(percentual, `Progresso: ${processados} / ${total}`);

                if (percentual >= 100) {
                    console.log("✅ Todos os disparos foram processados.");
                    clearInterval(interval);
                    loadComunicadosStatus(); // Atualiza a tabela principal
                }
            } catch (err) {
                console.error("❌ Erro ao buscar progresso:", err);
            }
        }, 3000); // Verifica a cada 3 segundos
    }

    // --- CARREGAMENTO DE OPÇÕES DINÂMICAS ---

    async function loadReferenciaOptions(type) {
        console.log(`📂 Buscando lista de ${type}...`);
        const headers = getAuthHeader();
        if (Object.keys(headers).length === 0) return;

        const endpoint = type === 'EMPRESA' ? '/api/comunicados/empresas' : '/api/comunicados/unidades';

        try {
            const response = await fetch(endpoint, { headers });
            const data = await response.json();
            
            if (!referenciaSelect) return;

            referenciaSelect.innerHTML = '<option value="">Selecione...</option>';
            
            // Aceita tanto array simples quanto objeto com propriedade
            const items = Array.isArray(data) ? data : (data.unidades || data.empresas || []);

            items.forEach(item => {
                const opt = document.createElement('option');
                // Se for objeto (Unidade), usa id. Se for string (Empresa), usa o texto.
                opt.value = typeof item === 'object' ? item.id : item;
                opt.textContent = typeof item === 'object' ? item.nome : item;
                referenciaSelect.appendChild(opt);
            });

            referenciaLabel.textContent = `Selecione a ${type === 'EMPRESA' ? 'Empresa' : 'Unidade'}:`;
            referenciaTypeInput.value = type;
            referenciaGroupDiv.style.display = 'block';
        } catch (error) {
            console.error("❌ Erro ao carregar opções:", error);
            showLocalMessage('Erro ao carregar lista de seleção.', 'error');
        }
    }

    // --- SUBMISSÃO DO FORMULÁRIO ---

    if (comunicadoForm) {
        comunicadoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const publico = publicoAlvoSelect.value;
            const headers = getAuthHeader();

            if (Object.keys(headers).length === 0) {
                showLocalMessage('Sua sessão expirou. Faça login novamente.', 'error');
                return;
            }

            if (publico === 'TODOS_MEDICOS' && !confirmarTodosCheckbox.checked) {
                showLocalMessage('Você deve marcar a confirmação para enviar a todos.', 'warning');
                return;
            }

            const titulo = document.getElementById('comunicado-titulo').value;
            const conteudo = document.getElementById('comunicado-conteudo').value;

            if(!titulo.trim() || !conteudo.trim()) {
                showLocalMessage('Título e conteúdo não podem estar vazios.', 'warning');
                return;
            }

            // Bloqueia o botão para evitar cliques duplos
            enviarButton.disabled = true;
            enviarButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';

            const payload = {
                titulo: titulo,
                conteudo: conteudo,
                publico_alvo: publico,
                referencia_id: (referenciaSelect && referenciaSelect.value) ? referenciaSelect.value : null,
                referencia_type: (referenciaTypeInput && referenciaTypeInput.value) ? referenciaTypeInput.value : null
            };

            console.log("🚀 Enviando comunicado:", payload);

            try {
                const response = await fetch('/api/comunicados', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...headers },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                if (response.ok) {
                    showLocalMessage('Disparos agendados com sucesso!', 'success');
                    comunicadoForm.reset();
                    
                    // Esconde grupos de campos específicos
                    if(referenciaGroupDiv) referenciaGroupDiv.style.display = 'none';
                    if(todosMedicosConfirmDiv) todosMedicosConfirmDiv.style.display = 'none';
                    
                    // Inicia o rastreamento visual
                    trackProgress(result.comunicado.id);
                } else {
                    showLocalMessage(result.erro || 'Erro ao processar envio.', 'error');
                }
            } catch (error) {
                console.error("❌ Erro na requisição POST:", error);
                showLocalMessage('Erro de conexão com o servidor.', 'error');
            } finally {
                enviarButton.disabled = false;
                enviarButton.innerHTML = '<i class="fas fa-paper-plane"></i> Iniciar Disparos em Massa';
            }
        });
    }

    // --- CARREGAMENTO DO HISTÓRICO ---

    async function loadComunicadosStatus() {
        if (!comunicadosStatusTableBody) return;
        const headers = getAuthHeader();
        if (Object.keys(headers).length === 0) return;

        try {
            const response = await fetch('/api/comunicados/status', { headers });
            const data = await response.json();
            
            if (!Array.isArray(data)) return;

            comunicadosStatusTableBody.innerHTML = data.map(c => `
                <tr>
                    <td><strong>${c.titulo}</strong></td>
                    <td><span class="badge-publico">${c.publico_alvo}</span></td>
                    <td>${c.total_enviado}</td>
                    <td>${c.total_ciente}</td>
                    <td>${c.taxa_ciente}%</td>
                    <td>${c.data_envio_oficial ? new Date(c.data_envio_oficial).toLocaleDateString('pt-BR') : 'Pendente'}</td>
                    <td>
                        <button class="btn-view" onclick="viewDetails(${c.id})">
                           <i class="fas fa-eye"></i> Detalhes
                        </button>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            console.error("❌ Erro ao carregar histórico:", err);
        }
    }

    // --- LISTENERS DE INTERFACE ---

    if (publicoAlvoSelect) {
        publicoAlvoSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            // Reseta visibilidade
            if(referenciaGroupDiv) referenciaGroupDiv.style.display = 'none';
            if(todosMedicosConfirmDiv) todosMedicosConfirmDiv.style.display = 'none';
            
            if(val === 'TODOS_MEDICOS') {
                todosMedicosConfirmDiv.style.display = 'block';
            } else if (val === 'EMPRESA' || val === 'UNIDADE') {
                loadReferenciaOptions(val);
            }
        });
    }

    // Inicializa a tabela ao carregar a página
    loadComunicadosStatus();
});

// =========================================================================
// 👁️ FUNÇÃO GLOBAL: DETALHES DO MODAL
// =========================================================================
async function viewDetails(id) {
    const modal = document.getElementById('modal-detalhes');
    const tableBody = document.getElementById('detalhes-comunicado-rows');
    const token = localStorage.getItem('token'); // Usa a chave correta
    
    if(modal) modal.style.display = 'block';
    if(!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="4">Carregando detalhes...</td></tr>';

    try {
        const response = await fetch(`/api/comunicados/detalhes/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const logs = await response.json();

        if (!Array.isArray(logs) || logs.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4">Nenhum registro de envio encontrado.</td></tr>';
            return;
        }

        tableBody.innerHTML = logs.map(log => `
            <tr>
                <td>${log.medico_nome}</td>
                <td>${log.whatsapp || 'Não informado'}</td>
                <td>
                    <span class="status-tag ${log.status_envio.toLowerCase()}">
                        ${log.status_envio}
                    </span>
                </td>
                <td>${log.status_ciente === 'CIENTE' ? '✅ Sim' : '⏳ Não'}</td>
            </tr>
        `).join('');
    } catch (err) {
        console.error("❌ Erro ao abrir modal:", err);
        tableBody.innerHTML = '<tr><td colspan="4">Erro ao carregar dados do servidor.</td></tr>';
    }
}