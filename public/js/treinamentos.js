// public/js/treinamentos.js

// Atualiza Data/Hora
function updateClock() {
    const now = new Date();
    const el = document.getElementById('current-datetime');
    if(el) el.textContent = now.toLocaleString('pt-BR');
}
setInterval(updateClock, 1000);
updateClock();

async function liberarAcesso() {
    const doc = document.getElementById('doc-medico').value.trim();
    const unidade = document.getElementById('select-unidade').value;

    if (!doc || !unidade) {
        alert("Por favor, preencha o CRM/CPF e selecione a unidade.");
        return;
    }

    // Esconde o modal
    document.getElementById('auth-overlay').classList.add('hidden');
    document.getElementById('display-identificacao').innerHTML = 
        `<i class="fas fa-user-md"></i> Médico: <strong>${doc}</strong> | Unidade: <strong>${unidade}</strong>`;
    
    // BUSCA OS ARQUIVOS REAIS NO SERVIDOR
    await buscarArquivosReais(unidade);
}

async function buscarArquivosReais(unidade) {
    const container = document.getElementById('container-arquivos');
    container.innerHTML = '<p style="padding: 20px;">Carregando arquivos...</p>';

    try {
        const response = await fetch(`/api/treinamentos/listar/${unidade}`);
        const arquivos = await response.json();

        renderizarArquivos(arquivos);
    } catch (error) {
        console.error("Erro ao buscar arquivos:", error);
        container.innerHTML = '<p style="padding: 20px; color: red;">Erro ao carregar arquivos do servidor.</p>';
    }
}

function renderizarArquivos(lista) {
    const container = document.getElementById('container-arquivos');
    container.innerHTML = '';

    if (lista.length === 0) {
        container.innerHTML = '<p style="padding: 20px;">Nenhum arquivo encontrado nesta pasta no servidor.</p>';
        return;
    }

    lista.forEach(arq => {
        // Define o ícone com base na extensão
        let iconClass = 'fa-file-pdf';
        if (['pptx', 'ppt'].includes(arq.tipo)) iconClass = 'fa-file-powerpoint';
        if (['png', 'jpg', 'jpeg'].includes(arq.tipo)) iconClass = 'fa-file-image';

        const card = `
            <div class="file-card">
                <i class="fas ${iconClass} file-icon"></i>
                <div class="file-info">
                    <h4>${arq.nome}</h4>
                    <p>Formato: ${arq.tipo.toUpperCase()}</p>
                </div>
                <a href="${arq.path}" class="btn-download" onclick="registrarDownload('${arq.nome}')" download>
                    <i class="fas fa-download"></i> Baixar Arquivo
                </a>
            </div>
        `;
        container.innerHTML += card;
    });
}

function registrarDownload(nomeArquivo) {
    const doc = document.getElementById('doc-medico').value;
    const unidade = document.getElementById('select-unidade').value;
    const dataHora = new Date().toLocaleString('pt-BR');

    const logString = `Data: ${dataHora} | Médico: ${doc} | Unidade: ${unidade} | Arquivo: ${nomeArquivo}`;

    fetch('/api/treinamentos/registrar-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logData: logString })
    }).catch(err => console.error("Erro ao registrar log:", err));
}