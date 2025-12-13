// public/js/login.js (CORRIGIDO)

const loginForm = document.getElementById('loginForm');
const messageArea = document.getElementById('message-area');

// Função para exibir mensagens na tela
function displayMessage(message, type) {
    messageArea.textContent = message;
    messageArea.className = '';
    messageArea.classList.add(type);
    messageArea.style.display = 'block';
}

// Função para processar o login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const senha = document.getElementById('password').value;

    messageArea.style.display = 'none';

    try {
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, senha }),
        });

        const data = await response.json();

        if (response.ok) {
            // Login bem-sucedido
            displayMessage('Login realizado com sucesso! Redirecionando...', 'success');
            
            // 1. Armazena o token e dados do usuário 
            localStorage.setItem('userToken', data.token);
            localStorage.setItem('userName', data.usuario.nome);
            
            // 2. Redireciona para o Dashboard
            setTimeout(() => {
                window.location.href = '/dashboard.html'; 
            }, 1500); 

        } else {
            // Login falhou
            displayMessage(data.erro || 'E-mail ou senha incorretos. Tente novamente.', 'error');
        }

    } catch (error) {
        console.error('Erro na requisição de login:', error);
        displayMessage('Problema de conexão com o servidor. Tente mais tarde.', 'error');
    }
});

// Implementação do link de cadastro (ÚNICO E CORRETO)
document.getElementById('register-link').addEventListener('click', (e) => {
    e.preventDefault();
    // Redireciona para a página de cadastro
    window.location.href = 'register.html'; 
});