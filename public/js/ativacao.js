document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const agendamentoId = urlParams.get('id');

    if (!agendamentoId) {
        showMessage('ID do agendamento não encontrado na URL.', 'error');
        document.getElementById('loading-area').style.display = 'none';
        return;
    }

    // Carregar informações iniciais do agendamento (opcional, mas recomendado para exibir nome do médico)
    loadAgendamentoInfo(agendamentoId);

    const ativacaoForm = document.getElementById('ativacao-form');
    ativacaoForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const dataSelecionada = document.getElementById('input-data').value;
        const horarioSelecionado = document.getElementById('input-horario').value;

        if (!dataSelecionada || !horarioSelecionado) {
            showMessage('Por favor, selecione a data e o horário.', 'error');
            return;
        }

        // 1. Confirmação
        // O JS parseia a data sem o 'T00:00:00' para lidar melhor com fusos horários em toLocaleDateString
        const dataFormatada = new Date(dataSelecionada).toLocaleDateString('pt-BR', { timeZone: 'UTC' }); 
        const horarioFormatado = horarioSelecionado.substring(0, 5);

        if (!confirm(`Confirmar o agendamento de ativação para o dia ${dataFormatada} às ${horarioFormatado}?`)) {
            return;
        }

        // 2. Envia para o backend (Pré-Agendamento)
        submitAgendamento(agendamentoId, dataSelecionada, horarioSelecionado);
    });
});

/**
 * Exibe uma mensagem na área de mensagens.
 * @param {string} message - A mensagem a ser exibida.
 * @param {string} type - O tipo de mensagem ('success' ou 'error').
 */
function showMessage(message, type = 'success') {
    const messageArea = document.getElementById('message-area');
    messageArea.textContent = message;
    messageArea.className = `message-area message-${type}`;
    messageArea.style.display = 'block';
}

/**
 * Carrega informações básicas do agendamento (usado apenas para fins de exibição).
 * @param {string} id - ID do agendamento.
 */
async function loadAgendamentoInfo(id) {
    try {
        // A rota correta no backend deve ser /api/agendamentos/ativacao/publico/:id
        const response = await fetch(`/api/agendamentos/ativacao/publico/${id}`); 
        const data = await response.json();

        document.getElementById('loading-area').style.display = 'none';

        if (response.ok) {
            document.getElementById('medico-nome-display').textContent = data.medico_nome || 'N/A';
            document.getElementById('unidade-nome-display').textContent = data.unidade_nome || 'N/A';
            document.getElementById('agendamento-info').style.display = 'block';
            document.getElementById('ativacao-form').style.display = 'block';
        } else {
            showMessage(data.erro || 'Agendamento inválido ou não encontrado.', 'error');
        }
    } catch (error) {
        console.error('Erro ao carregar dados do agendamento:', error);
        showMessage('Erro de conexão com o servidor. Tente novamente.', 'error');
    }
}

/**
 * Envia os dados de data/horário selecionados para o backend e atualiza o status.
 * @param {string} id - ID do agendamento.
 * @param {string} data - Data selecionada (AAAA-MM-DD).
 * @param {string} horario - Horário selecionado (HH:MM:SS).
 */
async function submitAgendamento(id, data, horario) {
    const submitButton = document.getElementById('submit-button');
    submitButton.disabled = true;
    submitButton.textContent = 'Agendando...';

    try {
        // Rota POST para recebimento de seleção
        const response = await fetch(`/api/agendamentos/ativacao/selecao/${id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                // 🛑 CORRIGIDO: Usando os nomes que o backend espera
                data_preferencial: data, 
                horario_preferencial: horario,
                // 🛑 CORRIGIDO: Incluindo o status que o backend valida
                status: 'ATIVACAO_PRE_AGENDADA' 
            })
        });

        const result = await response.json();

        if (response.ok) {
            showMessage('✅ Pré-Agendamento de Ativação Recebido! Aguarde a confirmação da equipe.', 'success');
            document.getElementById('ativacao-form').style.display = 'none';
        } else {
            showMessage(result.erro || 'Erro ao pré-agendar no servidor.', 'error');
        }

    } catch (error) {
        console.error('Erro de conexão ao submeter o agendamento:', error);
        showMessage('Erro de conexão com o servidor. Verifique sua rede.', 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Confirmar Agendamento de Ativação';
    }
}