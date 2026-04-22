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
    
    // Elementos de Seleção
    const dataSelecionadaEl = document.getElementById('data-selecionada');
    const areaHorarios = document.getElementById('area-horarios'); 
    const listaHorarios = document.getElementById('lista-horarios'); 
    
    const statusMessageEl = document.getElementById('status-message');
    const submitButton = document.getElementById('submit-button');

    let horarioSelecionado = null;
    let unidadeIdAtual = null; 

    /**
     * Gera dinamicamente apenas Segundas, Quartas e Sextas.
     */
    function generateDynamicDates(weeksCount = 6) {
        const dates = [];
        const today = new Date();
        
        for (let i = 0; i < weeksCount * 7; i++) {
            const current = new Date();
            current.setDate(today.getDate() + i);
            const dayOfWeek = current.getDay(); 
            
            // 1 = Segunda, 3 = Quarta, 5 = Sexta
            if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
                const yyyy = current.getFullYear();
                const mm = String(current.getMonth() + 1).padStart(2, '0');
                const dd = String(current.getDate()).padStart(2, '0');
                dates.push(`${yyyy}-${mm}-${dd}`);
            }
        }
        return dates;
    }

    /**
     * Popula o campo SELECT com as datas válidas.
     */
    function populateDateOptions() {
        if (!dataSelecionadaEl) return;
        dataSelecionadaEl.innerHTML = '<option value="">Selecione o dia disponível...</option>';
        const availableDates = generateDynamicDates();

        availableDates.forEach(dateStr => {
            const [year, month, day] = dateStr.split('-');
            const dateObj = new Date(year, month - 1, day);
            const label = dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
            
            const option = document.createElement('option');
            option.value = dateStr; 
            option.textContent = label.charAt(0).toUpperCase() + label.slice(1);
            dataSelecionadaEl.appendChild(option);
        });
    }

    /**
     * Gera a grade de horários com FILTRO DE EXCLUSIVIDADE
     */
    async function generateTimeGrid(dataSelecionada) {
        listaHorarios.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Verificando disponibilidade...</p>';
        horarioSelecionado = null;
        submitButton.disabled = true;

        try {
            // AJUSTE: Incluído unidade_id na URL para evitar erro 400 no backend e filtragem correta
            // ROTA: Alterada de /api para /auth conforme seu authRoutes.js
            const response = await fetch(`/auth/public/agendamentos/disponibilidade?data=${dataSelecionada}&unidade_id=${unidadeIdAtual}`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.erro || 'Erro ao consultar disponibilidade');
            }

            const ocupados = await response.json(); 
            renderGrid(Array.isArray(ocupados) ? ocupados : []);

        } catch (error) {
            console.error('Erro na requisição de disponibilidade:', error);
            listaHorarios.innerHTML = `<p style="color: #e74c3c;"><b>Erro:</b> ${error.message}. <br>Tente selecionar a data novamente.</p>`;
        }
    }

    /**
     * Função para desenhar os botões de horário
     */
    function renderGrid(ocupados) {
        listaHorarios.innerHTML = "";
        let hora = 13;
        let min = 0;
        let botaosGerados = 0;

        // Gera slots de 20 em 20 min das 13h às 17h
        while (hora < 17 || (hora === 17 && min === 0)) {
            const time = `${String(hora).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
            
            // REGRA DE EXCLUSIVIDADE:
            // Oculta o horário se ele estiver ocupado por um hospital DIFERENTE do hospital do médico atual.
            // Se o hospital for o mesmo (unidade_id igual), o horário continua aparecendo para permitir múltiplos médicos.
            const conflitoOutroHospital = ocupados.some(ag => 
                (ag.horario === time || (ag.horario_preferencial && ag.horario_preferencial.substring(0,5) === time)) && 
                String(ag.unidade_id) !== String(unidadeIdAtual)
            );

            if (!conflitoOutroHospital) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'btn-horario';
                btn.innerHTML = `<b>${time}</b>`;
                
                btn.onclick = () => {
                    document.querySelectorAll('.btn-horario').forEach(b => b.classList.remove('selecionado'));
                    btn.classList.add('selecionado');
                    horarioSelecionado = time;
                    submitButton.disabled = false;
                };
                listaHorarios.appendChild(btn);
                botaosGerados++;
            }

            min += 20;
            if (min >= 60) { min = 0; hora++; }
        }

        if (botaosGerados === 0) {
            listaHorarios.innerHTML = "<p style='color: orange;'>Nenhum horário disponível para esta data (exclusividade de outra unidade).</p>";
        }
    }

    // Listener para carregar horários ao selecionar data
    dataSelecionadaEl.addEventListener('change', (e) => {
        if (e.target.value) {
            areaHorarios.style.display = 'block';
            generateTimeGrid(e.target.value);
        } else {
            areaHorarios.style.display = 'none';
        }
    });

    function displayStatus(message, type) {
        statusMessageEl.textContent = message;
        statusMessageEl.className = `${type}-state`;
        
        if (type !== 'loading') {
            if (infoArea) infoArea.style.display = 'none';
            if (selecaoDataForm) selecaoDataForm.style.display = 'none';
        }

        if (type === 'loading') {
            statusMessageEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${message}`;
        }
        statusMessageEl.style.display = 'block';
    }

    async function loadConviteDetails() {
        if (!agendamentoId) return displayStatus('Erro: Link de convite inválido.', 'error');
        displayStatus('Carregando seus dados...', 'loading');

        try {
            // ROTA: Alterada de /api para /auth conforme seu authRoutes.js
            const response = await fetch(`/auth/public/agendamentos/convite/${agendamentoId}`);
            const result = await response.json();

            if (!response.ok) return displayStatus(result.erro || 'Este convite não está mais ativo.', 'error');

            const agendamento = result.agendamento;
            unidadeIdAtual = agendamento.unidade_id; // Define o hospital atual para o filtro de exclusividade

            if (agendamento.status !== 'PENDENTE' && agendamento.status !== 'CONVITE_ENVIADO') {
                return displayStatus('Este agendamento já foi preenchido ou está em processamento.', 'error');
            }

            medicoNomeEl.textContent = agendamento.medico_nome || 'Doutor(a)';
            unidadeNomeEl.textContent = agendamento.unidade_nome || 'N/A';
            
            let certs = [];
            if (agendamento.pals) certs.push('PALS');
            if (agendamento.acls) certs.push('ACLS');
            certificacoesEl.textContent = certs.length > 0 ? certs.join(' e ') : 'Nenhuma';
            
            populateDateOptions();
            infoArea.style.display = 'block';
            statusMessageEl.style.display = 'none';
            selecaoDataForm.style.display = 'block';

        } catch (error) {
            console.error('Erro ao carregar detalhes:', error);
            displayStatus('Falha na conexão. Por favor, verifique sua internet e recarregue a página.', 'error');
        }
    }
    
    selecaoDataForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data_preferencial = dataSelecionadaEl.value;
        
        if (!data_preferencial || !horarioSelecionado) {
            alert('Por favor, selecione um dia e um horário disponível.');
            return;
        }

        submitButton.disabled = true;
        submitButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Confirmando...`;

        try {
            // ROTA: Alterada de /api para /auth conforme seu authRoutes.js
            const response = await fetch(`/auth/public/agendamentos/selecionar-data/${agendamentoId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    data_preferencial, 
                    horario_preferencial: horarioSelecionado
                })
            });

            if (response.ok) {
                const dataBR = data_preferencial.split('-').reverse().join('/');
                displayStatus(
                    `Sucesso! Dr(a) ${medicoNomeEl.textContent}, sua integração no ${unidadeNomeEl.textContent} foi pré-agendada para ${dataBR} às ${horarioSelecionado}.`, 
                    'success'
                );
            } else {
                const result = await response.json();
                displayStatus(`Erro ao salvar: ${result.erro}`, 'error');
                submitButton.disabled = false;
                submitButton.innerHTML = `<i class="fas fa-calendar-alt"></i> Confirmar Seleção`;
            }
        } catch (error) {
            displayStatus('Erro de conexão ao salvar sua escolha.', 'error');
            submitButton.disabled = false;
        }
    });

    loadConviteDetails();
});