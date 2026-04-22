// public/js/admin-treinamentos.js
let todosOsLogs = [];

async function carregarLogs() {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '<tr><td colspan="4">Carregando dados...</td></tr>';

    try {
        const response = await fetch('/api/admin/logs-treinamento');
        todosOsLogs = await response.json();
        renderizarTabela(todosOsLogs);
    } catch (error) {
        console.error("Erro ao carregar auditoria:", error);
        tbody.innerHTML = '<tr><td colspan="4" style="color:red">Erro ao carregar logs do servidor.</td></tr>';
    }
}

function renderizarTabela(lista) {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">Nenhum registro de download encontrado.</td></tr>';
        return;
    }

    lista.forEach(log => {
        const badgeClass = `badge-${log.unidade?.toLowerCase()}`;
        const row = `
            <tr>
                <td>${log.data}</td>
                <td><strong>${log.medico}</strong></td>
                <td><span class="badge ${badgeClass}">${log.unidade}</span></td>
                <td><i class="far fa-file-alt"></i> ${log.arquivo}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

function filtrarTabela() {
    const buscaMedico = document.getElementById('filter-medico').value.toLowerCase();
    const buscaUnidade = document.getElementById('filter-unidade').value;

    const filtrados = todosOsLogs.filter(log => {
        const matchMedico = log.medico.toLowerCase().includes(buscaMedico);
        const matchUnidade = buscaUnidade === "" || log.unidade === buscaUnidade;
        return matchMedico && matchUnidade;
    });

    renderizarTabela(filtrados);
}

// Inicializa
carregarLogs();