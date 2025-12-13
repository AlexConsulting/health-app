// public/js/dashboard-base.js

const logoutButton = document.getElementById('logout-button');
const welcomeMessage = document.getElementById('welcome-message');
const currentDateTimeElement = document.getElementById('current-datetime');


// --- FUNÇÕES DE BASE ---

function getToken() {
    return localStorage.getItem('userToken');
}

function showMessage(message, type) {
    // Implementação básica para mostrar mensagens em qualquer lugar
    // Você pode precisar de um elemento de mensagem global em seu HTML
    console.log(`[${type.toUpperCase()}]: ${message}`);
    alert(message); // Simplificado para fins de exemplo
}

// Função para fazer requisição autenticada (Obrigatório o token JWT)
async function fetchAuthenticatedData(endpoint, token, options = {}) {
    const defaultOptions = {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`, 
            'Content-Type': 'application/json'
        },
    };

    const finalOptions = { ...defaultOptions, ...options };
    if (options.body) {
         // Se o corpo já foi definido no options, não faz nada.
    } else if (finalOptions.method === 'POST' || finalOptions.method === 'PUT') {
        finalOptions.body = JSON.stringify(options.body || {});
    }

    const response = await fetch(endpoint, finalOptions);

    if (response.status === 401) {
        localStorage.removeItem('userToken');
        localStorage.removeItem('userName');
        alert('Sessão inválida ou expirada. Faça o login novamente.');
        window.location.href = '/login.html';
        return { ok: false, status: 401 }; // Retorna um objeto para ser tratado
    }
    
    // Retorna a própria resposta para que o chamador possa verificar response.ok
    return response; 
}

// Função para atualizar data e hora
function updateDateTime() {
    if (!currentDateTimeElement) return;
    const now = new Date();
    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit' };
    
    const date = now.toLocaleDateString('pt-BR', dateOptions);
    const time = now.toLocaleTimeString('pt-BR', timeOptions);
    
    currentDateTimeElement.textContent = `${date} | ${time}`;
}


// --- INICIALIZAÇÃO E EVENTOS GLOBAIS ---

function initializeBase() {
    const token = getToken();
    const userName = localStorage.getItem('userName');

    if (!token || !userName) {
        if (window.location.pathname !== '/login.html') {
             alert('Sessão expirada. Faça o login novamente.');
             window.location.href = '/login.html';
        }
        return;
    }
    
    if (welcomeMessage) {
        welcomeMessage.textContent = `Olá, ${userName}`;
    }
    
    updateDateTime();
    setInterval(updateDateTime, 60000); 
}

// Função de Logout
if (logoutButton) {
    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('userToken');
        localStorage.removeItem('userName');
        alert('Sessão encerrada com sucesso.');
        window.location.href = '/login.html';
    });
}

// Inicia a lógica básica em todas as páginas
document.addEventListener('DOMContentLoaded', initializeBase);