// public/js/register.js

const registerForm = document.getElementById('registerForm');
const messageArea = document.getElementById('message-area');

// Função para exibir mensagens na tela
function displayMessage(message, type) {
    messageArea.textContent = message;
    messageArea.className = '';
    messageArea.classList.add(type);
    messageArea.style.display = 'block';
}

// Função para processar o cadastro
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nome = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const senha = document.getElementById('password').value;

    messageArea.style.display = 'none';

    try {
        const response = await fetch('/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ nome, email, senha }),
        });

        const data = await response.json();

        if (response.ok) {
            // Cadastro bem-sucedido
            displayMessage('✅ Usuário cadastrado! Redirecionando para o login...', 'success');
            
            // Redireciona para a página de login após o sucesso
            setTimeout(() => {
                window.location.href = 'login.html'; 
            }, 2000); 

        } else {
            // Cadastro falhou (ex: e-mail já existe)
            displayMessage(data.erro || 'Erro ao cadastrar usuário. Tente outro e-mail.', 'error');
        }

    } catch (error) {
        console.error('Erro na requisição de cadastro:', error);
        displayMessage('Problema de conexão com o servidor. Tente mais tarde.', 'error');
    }
});