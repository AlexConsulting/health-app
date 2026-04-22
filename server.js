// server.js - COMPLETO, INTEGRADO E PROTEGIDO
// by Alex Silva - Atualizado em 2026

const express = require('express');
require('dotenv').config();
const path = require('path');
const http = require('http'); 
const { Server } = require('socket.io'); 
const logger = require('./log/logger');
const fs = require('fs'); 

// === 1. IMPORTAR ROTAS E CONEXÃO ===
const db = require('./db/config'); 
const authRoutes = require('./src/routes/authRoutes'); 
const apiRoutes = require('./src/routes/apiRoutes'); 

const app = express();
const server = http.createServer(app); 

// === 2. CONFIGURAÇÃO DO SOCKET.IO ===
const io = new Server(server, {
    serveClient: false, 
    path: '/socket.io-handler/',
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// === 3. MIDDLEWARES DE PRIORIDADE ===
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Middleware de Log de Requisições
app.use((req, res, next) => {
    logger.info(`Requisição: ${req.method} ${req.originalUrl}`);
    next();
});

// Disponibiliza o IO para os Controllers
app.use((req, res, next) => {
    req.io = io;
    next();
});

// === 4. LÓGICA DO CHAT (SOCKET.IO) ===
io.on('connection', (socket) => {
    logger.info(`Novo cliente conectado ao socket: ${socket.id}`);

    socket.on('iniciar_sessao', async (nome) => {
        try {
            const query = 'INSERT INTO suporte_sessoes (nome_usuario, status) VALUES ($1, $2) RETURNING id';
            const result = await db.query(query, [nome, 'aberto']);
            const sessaoId = result.rows[0].id;

            socket.join(`sessao_${sessaoId}`);
            socket.emit('sessao_criada', sessaoId);
            io.emit('nova_sessao_disponivel', { id: sessaoId, nome: nome });
            
            logger.info(`Chat iniciado: Sessão ${sessaoId} para [${nome}]`);
        } catch (err) {
            logger.error(`Erro ao iniciar sessão socket: ${err.message}`);
            socket.emit('erro_sistema', 'Erro ao processar solicitação de chat.');
        }
    });

    socket.on('iniciar_sessao_ti', (sessaoId) => {
        socket.join(`sessao_${sessaoId}`);
        logger.info(`Técnico ${socket.id} entrou na sala da Sessão ${sessaoId}`);
    });

    socket.on('enviar_mensagem', async (data) => {
        const { sessao_id, remetente, mensagem } = data;
        if (!sessao_id || !mensagem) return;

        try {
            await db.query(
                'INSERT INTO suporte_mensagens (sessao_id, remetente, mensagem) VALUES ($1, $2, $3)',
                [sessao_id, remetente, mensagem]
            );

            io.to(`sessao_${sessao_id}`).emit('nova_mensagem', { 
                sessao_id,
                remetente, 
                mensagem,
                data: new Date()
            });
        } catch (err) {
            logger.error(`Erro ao salvar mensagem: ${err.message}`);
        }
    });

    socket.on('disconnect', () => {
        logger.info(`Cliente desconectado: ${socket.id}`);
    });
});

// === 5. DEFINIÇÃO DE ROTAS ===
app.use('/auth', authRoutes); 
app.use('/api', apiRoutes);

// === 5.1 ROTAS PÚBLICAS DE AGENDAMENTO ===

// Rota para buscar detalhes do convite
app.get('/api/public/agendamentos/convite/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT 
                a.id, a.status, a.pals, a.acls, a.unidade_id,
                m.nome as medico_nome, 
                u.nome as unidade_nome
            FROM agendamentos a
            LEFT JOIN medicos m ON a.medico_id = m.id
            LEFT JOIN unidades u ON a.unidade_id = u.id
            WHERE a.id = $1
        `;
        const result = await db.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ erro: 'Agendamento não encontrado.' });
        }
        res.json({ agendamento: result.rows[0] });
    } catch (err) {
        logger.error(`Erro ao buscar convite: ${err.message}`);
        res.status(500).json({ erro: 'Erro interno ao carregar convite.' });
    }
});

// 💡 CORRIGIDA: Rota para verificar disponibilidade com proteção contra Erro 400
app.get('/api/public/agendamentos/disponibilidade', async (req, res) => {
    try {
        const { data } = req.query;
        if (!data) return res.json([]); // Retorna array vazio em vez de erro para não quebrar o .some()

        const query = `
            SELECT horario_preferencial as horario, unidade_id 
            FROM agendamentos 
            WHERE data_preferencial = $1 
            AND status IN ('PRE_AGENDADO', 'CONFIRMADO')
        `;
        const result = await db.query(query, [data]);
        res.json(result.rows || []); 
    } catch (err) {
        logger.error(`Erro ao buscar disponibilidade: ${err.message}`);
        res.status(500).json([]); // Retorna array vazio para evitar crash no frontend
    }
});

// Rota para gravar a seleção do médico
app.post('/api/public/agendamentos/selecionar-data/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { data_preferencial, horario_preferencial, status } = req.body;

        const query = `
            UPDATE agendamentos 
            SET data_preferencial = $1, 
                horario_preferencial = $2, 
                status = $3,
                data_atualizacao = NOW()
            WHERE id = $4
            RETURNING id
        `;
        const result = await db.query(query, [data_preferencial, horario_preferencial, status, id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ erro: 'Erro ao atualizar agendamento.' });
        }

        io.emit('agendamento_atualizado', { id, status: 'PRE_AGENDADO' });
        res.json({ mensagem: 'Seleção gravada com sucesso!' });
    } catch (err) {
        logger.error(`Erro ao gravar seleção: ${err.message}`);
        res.status(500).json({ erro: 'Erro interno ao salvar data.' });
    }
});

// === 6. ROTAS DE PÁGINAS ===
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/suporte', (req, res) => res.sendFile(path.join(__dirname, 'public', 'suporte.html')));
app.get('/painel-ti', (req, res) => res.sendFile(path.join(__dirname, 'public', 'painel-ti.html')));
app.get('/treinamentos', (req, res) => res.sendFile(path.join(__dirname, 'public', 'treinamentos.html')));
app.get('/selecionar-data', (req, res) => res.sendFile(path.join(__dirname, 'public', 'selecionar-data.html')));

// === 7. ENDPOINTS DE SUPORTE ===
app.get('/api/suporte/sessoes', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM suporte_sessoes WHERE status = $1 ORDER BY id DESC', ['aberto']);
        return res.json(result.rows || []);
    } catch (err) {
        logger.error(`Erro na API de sessões: ${err.message}`);
        return res.status(500).json([]); 
    }
});

app.get('/api/suporte/mensagens/:sessaoId', async (req, res) => {
    try {
        const { sessaoId } = req.params;
        const result = await db.query('SELECT * FROM suporte_mensagens WHERE sessao_id = $1 ORDER BY id ASC', [sessaoId]);
        return res.json(result.rows || []);
    } catch (err) {
        logger.error(`Erro na API de mensagens: ${err.message}`);
        return res.status(500).json([]); 
    }
});

// === LISTAGEM DE ARQUIVOS ===
app.get('/api/treinamentos/listar/:unidade', (req, res) => {
    const { unidade } = req.params;
    const directoryPath = path.join(__dirname, 'public', 'treinamentos', unidade);

    if (!fs.existsSync(directoryPath)) return res.json([]); 

    fs.readdir(directoryPath, (err, files) => {
        if (err) return res.status(500).json({ erro: 'Erro ao listar arquivos' });
        const listaArquivos = files
            .filter(file => ['.pdf', '.pptx', '.ppt', '.png', '.jpg', '.jpeg'].includes(path.extname(file).toLowerCase()))
            .map(file => ({
                nome: file,
                tipo: path.extname(file).replace('.', ''),
                path: `treinamentos/${unidade}/${file}`
            }));
        res.json(listaArquivos);
    });
});

// === REGISTRO DE DOWNLOAD ===
app.post('/api/treinamentos/registrar-download', (req, res) => {
    const { logData } = req.body;
    const dir = path.join(__dirname, 'public', 'treinamentos', '01-Controle');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.appendFile(path.join(dir, 'controle.txt'), logData + '\n', (err) => {
        if (err) return res.status(500).json({ erro: 'Falha ao registrar log.' });
        res.status(200).json({ status: 'Sucesso' });
    });
});

// === LEITURA DE LOGS DE AUDITORIA ===
app.get('/api/admin/logs-treinamento', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'treinamentos', '01-Controle', 'controle.txt');
    if (!fs.existsSync(filePath)) return res.json([]);

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ erro: 'Erro ao ler logs' });
        const logs = data.trim().split('\n').map(linha => {
            const partes = linha.split(' | ');
            return {
                data: partes[0]?.replace('Data: ', ''),
                medico: partes[1]?.replace('Médico: ', ''),
                unidade: partes[2]?.replace('Unidade: ', ''),
                arquivo: partes[3]?.replace('Arquivo: ', '')
            };
        });
        res.json(logs.reverse());
    });
});

// === 8. TRATAMENTO DE ERROS GLOBAL ===
app.use((err, req, res, next) => {
    logger.error(`Erro Fatal: ${err.message}`);
    if (res.headersSent) return next(err);
    res.status(500).json({ erro: 'Erro interno no servidor.' });
});

// === 9. INICIALIZAÇÃO ===
server.listen(PORT, () => {
    logger.info(`🚀 Servidor Health App rodando em http://localhost:${PORT}`);
    console.log(`Servidor iniciado na porta ${PORT}`);
});