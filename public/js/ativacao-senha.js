// public/js/ativacao-senha.js

const ativacaoTableBody = document.getElementById('ativacao-table-body');
const searchButton = document.getElementById('search-button');
const dataFilter = document.getElementById('filter-data');
const statusFilter = document.getElementById('filter-status');

const meetModal = document.getElementById('meet-modal');

const getToken = () => localStorage.getItem('userToken');

// 1. Carregar Ativações
async function loadAtivacoes() {
    const token = getToken();
    if (!token) return;

    const params = new URLSearchParams();
    if (dataFilter && dataFilter.value) params.append('data', dataFilter.value);
    if (statusFilter && statusFilter.value) params.append('status', statusFilter.value);

    try {
        const response = await fetch(`/api/ativacoes-senha?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Falha ao carregar dados');
        
        const data = await response.json();
        renderTable(data);
    } catch (error) {
        console.error('Erro ao carregar ativações:', error);
    }
}

// 2. Renderizar a Tabela - Focada em M'Boi
function renderTable(data) {
    if (!ativacaoTableBody) return;
    ativacaoTableBody.innerHTML = '';
    if (!Array.isArray(data)) return;

    data.forEach(item => {
        // 💡 Proteção extra frontend: Garante que apenas M'Boi apareça
        if (!item.unidade_nome || !item.unidade_nome.toUpperCase().includes('MBOI')) return;

        const tr = document.createElement('tr');
        
        const dataExibicao = item.data_agendamento 
            ? new Date(item.data_agendamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) 
            : '---';
        
        const statusAtual = item.status || 'PENDENTE';

        tr.innerHTML = `
            <td>${item.medico_nome || '---'}</td>
            <td>${item.unidade_nome || '---'}</td>
            <td>${dataExibicao}</td>
            <td>${item.horario_agendamento || '---'}</td>
            <td><span class="status-badge status-${statusAtual.toLowerCase()}">${statusAtual}</span></td>
            <td class="acoes-cell"></td>
        `;

        const acoesCell = tr.querySelector('.acoes-cell');
        const btnAcao = criarBotaoAcao(item);
        if (btnAcao) acoesCell.appendChild(btnAcao);

        ativacaoTableBody.appendChild(tr);
    });
}

// 3. Criação de botões
function criarBotaoAcao(item) {
    const btn = document.createElement('button');
    const telefone = item.telefone ? item.telefone.replace(/\D/g, '') : '';
    const statusAtual = item.status || 'PENDENTE';

    if (statusAtual === 'PENDENTE') {
        btn.className = 'btn-invite';
        btn.innerHTML = '<i class="fab fa-whatsapp"></i> Gerar Convite';
        btn.onclick = () => gerarConviteAtivacao(item.medico_id);
        return btn;
    }

    if (statusAtual === 'AGENDADO') {
        btn.className = 'btn-success';
        btn.innerHTML = '<i class="fab fa-whatsapp"></i> Iniciar Meet';
        btn.onclick = () => abrirModalMeet(item.ativacao_id, telefone, item.medico_nome, item.meet_link);
        return btn;
    }

    const span = document.createElement('span');
    span.className = 'text-muted';
    span.innerText = statusAtual === 'CONVITE_ENVIADO' ? 'Aguardando Médico' : 'Concluído';
    return span;
}

// 4. Gerar Convite
async function gerarConviteAtivacao(medicoId) {
    try {
        const response = await fetch(`/api/ativacoes-senha/gerar-convite/${medicoId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const result = await response.json();

        if (response.ok) {
            const mensagem = encodeURIComponent(`Olá Dr. ${result.medicoNome}, para ativar sua senha no Hospital M'Boi precisamos de uma breve call. Escolha seu horário aqui: ${result.linkSelecao}`);
            window.open(`https://wa.me/55${result.medicoTelefone.replace(/\D/g, '')}?text=${mensagem}`, '_blank');
            loadAtivacoes();
        } else {
            alert(result.erro || 'Erro ao gerar convite');
        }
    } catch (err) { 
        alert('Erro ao gerar convite'); 
    }
}

// 5. Modal Meet
function abrirModalMeet(id, telefone, nome, linkMeet) {
    if (!meetModal) return;
    meetModal.style.display = 'block';
    
    const inputLink = document.getElementById('input-link-meet');
    if (inputLink) inputLink.value = linkMeet || '';

    document.getElementById('btn-confirmar-envio-meet').onclick = async () => {
        const msg = encodeURIComponent(`Olá Dr. ${nome}, link da call M'Boi: ${linkMeet}`);
        window.open(`https://wa.me/55${telefone}?text=${msg}`, '_blank');
        
        if (confirm("Marcar como CONCLUÍDO?")) {
            await finalizarAtivacao(id, 'CONCLUIDO');
        }
        meetModal.style.display = 'none';
    };
}

async function finalizarAtivacao(id, statusFinal) {
    try {
        await fetch(`/api/ativacoes-senha/finalizar/${id}`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ statusFinal })
        });
        loadAtivacoes();
    } catch (err) { 
        console.error('Erro ao finalizar:', err); 
    }
}

document.querySelectorAll('.close-button, .close-button-meet').forEach(btn => {
    btn.onclick = () => { if (meetModal) meetModal.style.display = 'none'; };
});

document.addEventListener('DOMContentLoaded', loadAtivacoes);
if (searchButton) searchButton.addEventListener('click', loadAtivacoes);