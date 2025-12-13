// public/js/selecionar-data.js

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const agendamentoId = params.get('id');

    // DOM Elements
    const infoArea = document.getElementById('info-area');
    const medicoNomeEl = document.getElementById('medico-nome');
    const unidadeNomeEl = document.getElementById('unidade-nome');
    const certificacoesEl = document.getElementById('certificacoes');
    const selecaoDataForm = document.getElementById('selecao-data-form');
    const dataSelecionadaEl = document.getElementById('data-selecionada');
    const statusMessageEl = document.getElementById('status-message');
    const submitButton = document.getElementById('submit-button');

    // Datas disponíveis fixas (Seg, Qua, Sex - 15h)
    const availableDates = [
        // Dezembro/2025 (Seg, Qua, Sex)
        "2025-12-01|15:00", "2025-12-03|15:00", "2025-12-05|15:00", 
        "2025-12-08|15:00", "2025-12-10|15:00", "2025-12-12|15:00", 
        "2025-12-15|15:00", "2025-12-17|15:00", "2025-12-19|15:00", 
        "2025-12-22|15:00",
        // Janeiro/2026 (Seg, Qua, Sex)
        "2026-01-08|15:00", "2026-01-09|15:00", "2026-01-12|15:00", 
        "2026-01-15|15:00", "2026-01-16|15:00", "2026-01-19|15:00", 
        "2026-01-22|15:00", "2026-01-23|15:00", "2026-01-26|15:00", 
        "2026-01-29|15:00", "2026-01-30|15:00"
    ];

    /**
     * Exibe a mensagem de status na tela e esconde o formulário.
     * @param {string} message - Mensagem a ser exibida.
     * @param {string} type - Tipo da mensagem ('loading', 'error', 'success').
     */
    function displayStatus(message, type) {
        statusMessageEl.textContent = message;
        statusMessageEl.className = `${type}-state`;
        
        // Esconde os elementos de interação e informação
        infoArea.style.display = 'none';
        selecaoDataForm.style.display = 'none';

        if (type === 'loading') {
            statusMessageEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${message}`;
        }
        statusMessageEl.style.display = 'block';
    }

    /**
     * Formata uma string de data (YYYY-MM-DD) para (DD/MM/AAAA).
     * @param {string} dateString - Data no formato YYYY-MM-DD.
     * @returns {string} Data no formato DD/MM/AAAA.
     */
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    }

    /**
     * Carrega as opções de data e hora no select.
     */
    function populateDateOptions() {
        // Limpa opções antigas
        dataSelecionadaEl.innerHTML = '<option value="">Selecione uma data disponível</option>';

        availableDates.forEach(dateTimeStr => {
            const [date, time] = dateTimeStr.split('|');
            const formattedDate = formatDate(date);
            const option = document.createElement('option');
            
            // O valor é o formato YYYY-MM-DD|HH:MM, fácil de processar no backend
            option.value = dateTimeStr; 
            option.textContent = `${formattedDate} - ${time}h`;
            dataSelecionadaEl.appendChild(option);
        });
    }

    /**
     * Função principal para carregar os dados do convite.
     */
    async function loadConviteDetails() {
        if (!agendamentoId) {
            return displayStatus('Erro: Identificador de agendamento não fornecido no link.', 'error');
        }

        displayStatus('Carregando dados do convite...', 'loading');

        try {
            // 🛑 CORREÇÃO AQUI: Removido o '/public' da URL. A rota correta é /api/agendamentos/convite/:id
            const response = await fetch(`/api/agendamentos/convite/${agendamentoId}`);
            const result = await response.json();

            if (!response.ok) {
                // Se o ID já foi usado para pré-agendamento ou é inválido
                const message = result.erro || 'Convite inválido ou já utilizado.';
                return displayStatus(message, 'error');
            }

            const agendamento = result.agendamento;

            // 1. Verificar o status atual
            if (agendamento.status !== 'PENDENTE' && agendamento.status !== 'CONVITE_ENVIADO') {
                return displayStatus('Este agendamento já foi selecionado e/ou está em andamento. Entre em contato com o setor de Qualidade.', 'error');
            }

            // 2. Preencher a área de informações
            medicoNomeEl.textContent = agendamento.medico_nome || 'Médico(a) não identificado(a)';
            unidadeNomeEl.textContent = agendamento.unidade_nome || 'N/A';
            
            let certs = [];
            if (agendamento.pals) certs.push('PALS');
            if (agendamento.acls) certs.push('ACLS');
            certificacoesEl.textContent = certs.length > 0 ? certs.join(' e ') : 'Nenhuma';
            
            infoArea.style.display = 'block';

            // 3. Preencher opções e mostrar o formulário
            populateDateOptions();
            statusMessageEl.style.display = 'none';
            selecaoDataForm.style.display = 'block';

        } catch (error) {
            console.error('Erro ao carregar detalhes do convite:', error);
            displayStatus('Erro de conexão ao carregar os dados. Tente novamente.', 'error');
        }
    }
    
    // --- Lógica de Submissão do Formulário ---
    selecaoDataForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const selectedDateTime = dataSelecionadaEl.value;
        if (!selectedDateTime) {
            alert('Por favor, selecione uma data e horário.');
            return;
        }

        const [data_preferencial, horario_preferencial] = selectedDateTime.split('|');

        submitButton.disabled = true;
        submitButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Confirmando...`;

        try {
            // 🛑 CORREÇÃO AQUI: Removido o '/public' e corrigido o endpoint para '/selecao/'.
            const response = await fetch(`/api/agendamentos/selecao/${agendamentoId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    data_preferencial, 
                    horario_preferencial,
                    status: 'PRE_AGENDADO' // O backend deve garantir esta mudança
                })
            });

            const result = await response.json();

            if (response.ok) {
                displayStatus(
                    `Parabéns, Dr(a) ${medicoNomeEl.textContent}! Sua preferência de treinamento para o dia ${formatDate(data_preferencial)} às ${horario_preferencial}h foi registrada com sucesso. A Equipe de Qualidade entrará em contato para a confirmação final.`, 
                    'success'
                );
            } else {
                const message = result.erro || 'Erro ao registrar sua seleção. Tente novamente ou entre em contato.';
                displayStatus(`Falha: ${message}`, 'error');
            }

        } catch (error) {
            console.error('Erro ao submeter a seleção:', error);
            displayStatus('Erro de conexão ao tentar registrar a seleção.', 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = `<i class="fas fa-calendar-alt"></i> Confirmar Seleção`;
        }
    });

    // Inicia o carregamento
    loadConviteDetails();
});