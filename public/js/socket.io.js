<script src="/socket.io/socket.io.js"></script>
<script>
    const socket = io();
    let sessaoId = null;
    let nomeUsuario = "";

    function iniciarChat() {
        nomeUsuario = document.getElementById('nome-usuario').value;
        if(nomeUsuario) {
            socket.emit('iniciar_sessao', nomeUsuario);
            document.getElementById('login-area').style.display = 'none';
            document.getElementById('chat-area').style.display = 'block';
        }
    }

    socket.on('sessao_criada', (id) => { sessaoId = id; });

    function enviarMensagem() {
        const input = document.getElementById('msg-input');
        if(input.value) {
            socket.emit('enviar_mensagem', {
                sessao_id: sessaoId,
                remetente: 'usuario',
                mensagem: input.value
            });
            input.value = '';
        }
    }

    socket.on('nova_mensagem', (data) => {
        const box = document.getElementById('mensagens-box');
        const div = document.createElement('div');
        div.className = `msg ${data.remetente}`;
        div.innerHTML = `<strong>${data.remetente}:</strong> ${data.mensagem}`;
        box.appendChild(div);
        box.scrollTop = box.scrollHeight;
    });
</script>