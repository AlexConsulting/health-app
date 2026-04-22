// public/js/ativacao.js

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    const loadingArea = document.getElementById('loading-area');
    const infoArea = document.getElementById('agendamento-info');
    const form = document.getElementById('ativacao-form');
    const messageArea = document.getElementById('message-area');

    if (!token) {
        showError("Token de acesso inválido ou ausente. Por favor, use o link enviado no seu e-mail.");
        loadingArea.style.display = 'none';
        return;
    }

    try {
        // 1. Busca os dados do médico pelo token
        const response = await fetch(`/api/ativacoes-senha/validar-token/${token}`);
        const data = await response.json();

        if (!response.ok) throw new Error(data.erro || "Erro ao validar acesso.");

        // Preenche os nomes na tela
        document.getElementById('medico-nome-display').textContent = data.medico_nome;
        document.getElementById('unidade-nome-display').textContent = data.unidade_nome;

        loadingArea.style.display = 'none';
        infoArea.style.display = 'block';
        form.style.display = 'block';

    } catch (error) {
        loadingArea.style.display = 'none';
        showError(error.message);
    }

    // 2. Evento de envio do formulário
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = document.getElementById('submit-button');
        const dataAgendamento = document.getElementById('input-data').value;
        const horarioAgendamento = document.getElementById('input-horario').value;

        btn.disabled = true;
        btn.textContent = "Processando...";

        try {
            const response = await fetch(`/api/ativacoes-senha/confirmar-agendamento`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    data_agendamento: dataAgendamento,
                    horario_agendamento: horarioAgendamento
                })
            });

            const result = await response.json();

            if (!response.ok) throw new Error(result.erro);

            showSuccess("Agendamento realizado com sucesso! Em breve você receberá o link do Meet.");
            form.style.display = 'none';

        } catch (error) {
            showError(error.message);
            btn.disabled = false;
            btn.textContent = "Confirmar Agendamento de Ativação";
        }
    });

    function showError(msg) {
        messageArea.textContent = msg;
        messageArea.className = "message-error";
        messageArea.style.display = 'block';
    }

    function showSuccess(msg) {
        messageArea.textContent = msg;
        messageArea.className = "message-success";
        messageArea.style.display = 'block';
    }
});