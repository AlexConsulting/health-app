// public/js/comunicados.js

document.addEventListener('DOMContentLoaded', () => {
    // Variáveis globais para elementos DOM
    const comunicadoForm = document.getElementById('comunicado-form');
    const enviarButton = document.getElementById('enviar-button');
    const statusMessage = document.getElementById('status-message');
    const comunicadosStatusTableBody = document.getElementById('comunicados-status-table-body');
    const publicoAlvoSelect = document.getElementById('publico-alvo');
    
    // Variáveis para Referência Específica (Empresa/Unidade)
    const referenciaGroupDiv = document.getElementById('referencia-group'); // Novo ID para o div pai
    const referenciaSelect = document.getElementById('referencia-select');
    const referenciaLabel = document.getElementById('referencia-label');
    const referenciaTypeInput = document.getElementById('referencia-type');
    
    // Variáveis para Confirmação Geral (TODOS_MEDICOS) 🎯 NOVAS VARIÁVEIS
    const todosMedicosConfirmDiv = document.getElementById('todos-medicos-confirm'); 
    const confirmarTodosCheckbox = document.getElementById('confirmar-todos');
    
    const logoutButton = document.getElementById('logout-button');

    // Funções auxiliares (assumindo que dashboard-base.js existe para getToken e showMessage)
    // Se não existir, estas devem ser incluídas.
    // Exemplo:
    // const getToken = () => localStorage.getItem('userToken');
    // const showMessage = (msg, type, element) => { /* ... sua implementação ... */ };


    // ------------------------------------------------------------------
    // FUNÇÃO: Carrega as opções de Referência (Empresas/Unidades)
    // ------------------------------------------------------------------
    async function loadReferenciaOptions(type) {
        const token = getToken();
        if (!token) return;

        let endpoint = '';
        let label = '';
        let dataKey = ''; // Chave para extrair o array do JSON
        
        // Define o endpoint e a chave de dados com base no tipo
        if (type === 'EMPRESA') {
            endpoint = '/api/empresas';
            label = 'Selecione a Empresa:';
            dataKey = 'empresas'; // Supondo que o backend retorna { empresas: [...] }
        } else if (type === 'UNIDADE') {
            endpoint = '/api/unidades';
            label = 'Selecione a Unidade:';
            dataKey = 'unidades'; // Supondo que o backend retorna { unidades: [...] }
        } else {
            // Caso null, TODOS_MEDICOS, ou valor inválido: Reseta e oculta os campos
            referenciaSelect.disabled = true;
            referenciaSelect.innerHTML = '<option value="">Não Aplicável</option>';
            referenciaLabel.style.display = 'none';
            referenciaTypeInput.value = '';
            referenciaGroupDiv.style.display = 'none';
            return;
        }

        try {
            const response = await fetch(endpoint, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            referenciaSelect.innerHTML = '<option value="">Selecione...</option>';
            referenciaSelect.disabled = true;
            referenciaLabel.style.display = 'none';
            referenciaGroupDiv.style.display = 'block'; // Mostra o grupo antes de carregar

            if (response.ok) {
                const data = await response.json();
                
                const items = data[dataKey]; 

                if (Array.isArray(items)) {
                    items.forEach(item => {
                        const option = document.createElement('option');
                        option.value = item.id;
                        option.textContent = item.nome; 
                        referenciaSelect.appendChild(option);
                    });
                    
                    referenciaSelect.disabled = false;
                    referenciaLabel.textContent = label;
                    referenciaLabel.style.display = 'block';
                    referenciaTypeInput.value = type;

                } else {
                    showMessage(`Erro: O servidor retornou a lista de ${type.toLowerCase()} em um formato inválido.`, 'error', statusMessage);
                    console.error('Estrutura de dados inesperada:', data);
                }
            } else {
                const errorResult = await response.json();
                showMessage(errorResult.erro || `Erro HTTP ${response.status} ao carregar lista de ${type.toLowerCase()}.`, 'error', statusMessage);
                referenciaSelect.innerHTML = '<option value="">Erro ao carregar</option>';
            }
        } catch (error) {
            console.error('Erro de conexão ao carregar referências:', error);
            showMessage('Erro de conexão com o servidor. Verifique a API.', 'error', statusMessage);
            referenciaSelect.innerHTML = '<option value="">Falha de rede</option>';
        }
    }

    // Listener para o filtro de Público Alvo 🎯 ATUALIZADO PARA TODOS_MEDICOS
    publicoAlvoSelect.addEventListener('change', (e) => {
        const selectedValue = e.target.value;
        
        // Esconde ambos os grupos por padrão
        referenciaGroupDiv.style.display = 'none';
        todosMedicosConfirmDiv.style.display = 'none';
        confirmarTodosCheckbox.required = false;

        if (selectedValue === 'EMPRESA' || selectedValue === 'UNIDADE') {
            referenciaGroupDiv.style.display = 'flex'; // Exibe o grupo de referência
            loadReferenciaOptions(selectedValue);
        } else if (selectedValue === 'TODOS_MEDICOS') {
            todosMedicosConfirmDiv.style.display = 'block'; // Exibe o checkbox
            confirmarTodosCheckbox.required = true; // Torna o checkbox obrigatório
            loadReferenciaOptions(null); // Reseta a referência
        } else {
            loadReferenciaOptions(null); // Reseta
        }
    });


    // ------------------------------------------------------------------
    // FUNÇÃO: Envio do Formulário de Comunicado (POST /api/comunicados) 🎯 ATUALIZADO
    // ------------------------------------------------------------------
    comunicadoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const token = getToken();
        if (!token) {
            showMessage('Sessão expirada. Faça login novamente.', 'error', statusMessage);
            return;
        }

        const publicoAlvo = publicoAlvoSelect.value;

        // 🎯 Lógica de validação do checkbox para TODOS_MEDICOS
        if (publicoAlvo === 'TODOS_MEDICOS' && !confirmarTodosCheckbox.checked) {
            showMessage('Por favor, confirme o envio para TODOS os médicos cadastrados.', 'warning', statusMessage);
            return; // Impede o envio
        }

        enviarButton.disabled = true;
        enviarButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
        statusMessage.style.display = 'none';

        const payload = {
            titulo: document.getElementById('comunicado-titulo').value,
            conteudo: document.getElementById('comunicado-conteudo').value,
            publico_alvo: publicoAlvo,
            referencia_id: referenciaSelect.value || null,
            referencia_type: referenciaTypeInput.value || null
        };

        // Tratar os casos gerais/todos para não enviar IDs desnecessários
        if (publicoAlvo === 'TODOS_MEDICOS' || !publicoAlvo) {
            payload.referencia_id = null;
            payload.referencia_type = null;
        }


        try {
            const response = await fetch('/api/comunicados', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.ok) {
                showMessage(result.mensagem || 'Comunicado enviado e processo assíncrono iniciado!', 'success', statusMessage);
                comunicadoForm.reset();
                // Após o envio, recarrega a tabela de status
                loadComunicadosStatus(); 
                // Reseta o estado da UI para o padrão
                loadReferenciaOptions(null);
                todosMedicosConfirmDiv.style.display = 'none';
            } else {
                showMessage(result.erro || 'Erro desconhecido ao enviar comunicado.', 'error', statusMessage);
            }

        } catch (error) {
            console.error('Erro no envio do comunicado:', error);
            showMessage('Erro de conexão com o servidor. Tente novamente.', 'error', statusMessage);
        } finally {
            enviarButton.disabled = false;
            enviarButton.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Comunicado e Iniciar Rastreamento';
        }
    });
    
    // ------------------------------------------------------------------
    // FUNÇÃO: Carrega a Tabela de Status de Comunicados (GET /api/comunicados/status)
    // ------------------------------------------------------------------

    async function loadComunicadosStatus() {
        const token = getToken();
        if (!token) {
            comunicadosStatusTableBody.innerHTML = '<tr><td colspan="7">Sessão expirada. Faça login novamente.</td></tr>';
            return;
        }

        comunicadosStatusTableBody.innerHTML = '<tr><td colspan="7"><i class="fas fa-spinner fa-spin"></i> Carregando status...</td></tr>';
        
        try {
            const response = await fetch('/api/comunicados/status', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 401) {
                showMessage('Sessão expirada.', 'error');
                comunicadosStatusTableBody.innerHTML = '<tr><td colspan="7">Sessão expirada.</td></tr>';
                return;
            }

            const comunicados = await response.json();

            if (!response.ok) {
                showMessage(comunicados.erro || 'Erro ao carregar status dos comunicados.', 'error', statusMessage);
                comunicadosStatusTableBody.innerHTML = '<tr><td colspan="7">Erro ao carregar dados.</td></tr>';
                return;
            }

            if (comunicados.length === 0) {
                comunicadosStatusTableBody.innerHTML = '<tr><td colspan="7">Nenhum comunicado enviado ainda.</td></tr>';
                return;
            }
            
            // Montar as linhas da tabela
            const rows = comunicados.map(c => {
                // Formatação da data para o padrão DD/MM/AAAA HH:MM (se enviado)
                const dataEnvioFormatada = c.data_envio_oficial 
                    ? new Date(c.data_envio_oficial).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) 
                    : 'AGUARDANDO';
                
                let taxaCor = 'black';
                if (c.taxa_ciente >= 80) taxaCor = 'green';
                else if (c.taxa_ciente >= 50) taxaCor = 'orange';
                else if (c.taxa_ciente < 50) taxaCor = 'red';

                return `
                    <tr>
                        <td>${c.titulo}</td>
                        <td>${c.publico_alvo}</td>
                        <td>${c.total_enviado}</td>
                        <td>${c.total_ciente}</td>
                        <td style="color: ${taxaCor}; font-weight: bold;">${c.taxa_ciente}%</td>
                        <td>${dataEnvioFormatada}</td>
                        <td>
                            <button class="btn-secondary small" onclick="viewDetails(${c.id})"><i class="fas fa-search"></i> Detalhes</button>
                        </td>
                    </tr>
                `;
            }).join('');

            comunicadosStatusTableBody.innerHTML = rows;

        } catch (error) {
            console.error('Erro na requisição de status:', error);
            comunicadosStatusTableBody.innerHTML = '<tr><td colspan="7">Falha de conexão com a API.</td></tr>';
        }
    }
    
    // ------------------------------------------------------------------
    // FUNÇÃO: Inicialização
    // ------------------------------------------------------------------
    
    // Assume-se que 'dashboard-base.js' é carregado primeiro e contém 'getToken' e 'showMessage'
    const token = getToken(); 
    if (token) {
        // Carrega o status ao iniciar a página
        loadComunicadosStatus();
        
        // 🎯 ATUALIZADO: Carrega as opções iniciais (e aplica a lógica de visibilidade)
        const initialValue = publicoAlvoSelect.value;
        if (initialValue === 'EMPRESA' || initialValue === 'UNIDADE') {
            loadReferenciaOptions(initialValue); 
        } else if (initialValue === 'TODOS_MEDICOS') {
            referenciaGroupDiv.style.display = 'none';
            todosMedicosConfirmDiv.style.display = 'block';
            confirmarTodosCheckbox.required = true;
        } else {
            loadReferenciaOptions(null);
            todosMedicosConfirmDiv.style.display = 'none';
        }
    }
    
    // Placeholder para a função de ver detalhes (necessita de um novo modal ou rota)
    window.viewDetails = (comunicadoId) => {
        alert(`Implementar visualização detalhada para o Comunicado ID: ${comunicadoId}`);
        // Aqui você faria uma nova requisição GET /api/comunicados/detalhes/:id
    };

});