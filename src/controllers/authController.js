// src/controllers/authController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../../db/config'); // Conexão DB
const logger = require('../../log/logger'); // Logger para auditoria
const { v4: uuidv4 } = require('uuid'); // Para gerar IDs no cadastro (se necessário)

const JWT_SECRET = process.env.JWT_SECRET;

// ----------------------------------------------------
// Função Auxiliar para Cadastro: Cria o Hash da Senha
// ----------------------------------------------------
async function cadastrarUsuarioAcesso(req, res) {
    const { nome, email, senha, role = 'operador' } = req.body;

    if (!nome || !email || !senha) {
        logger.audit(`Tentativa de Cadastro Falhou: Dados incompletos.`, { email: email });
        return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios.' });
    }

    try {
        // 1. Gera o hash da senha (cost factor 10)
        const senhaHash = await bcrypt.hash(senha, 10);
        
        // 2. Insere o novo usuário na tabela Usuarios_Acesso
        const query = `
            INSERT INTO Usuarios_Acesso (nome, email, senha_hash, role)
            VALUES ($1, $2, $3, $4)
            RETURNING id, nome, email, role;
        `;
        const result = await pool.query(query, [nome, email, senhaHash, role]);
        
        const novoUsuario = result.rows[0];
        
        // Auditoria de sucesso
        logger.audit(`Cadastro de Novo Usuário de Acesso realizado com sucesso.`, { 
            user_id: novoUsuario.id, 
            user_nome: novoUsuario.nome 
        });

        // 3. Resposta de sucesso (não retorna a senha hash)
        res.status(201).json({ 
            mensagem: 'Usuário de acesso criado com sucesso.',
            usuario: { 
                id: novoUsuario.id, 
                nome: novoUsuario.nome,
                email: novoUsuario.email,
                role: novoUsuario.role
            }
        });

    } catch (error) {
        if (error.code === '23505') { // Código de erro PostgreSQL para UNIQUE violation
            return res.status(409).json({ erro: 'Este e-mail já está cadastrado.' });
        }
        logger.error(`Erro ao cadastrar novo usuário de acesso: ${error.message}`, { stack: error.stack });
        res.status(500).json({ erro: 'Erro interno ao tentar cadastrar usuário.' });
    }
}

// ----------------------------------------------------
// Função de Login: Verifica Senha e Gera JWT
// ----------------------------------------------------
async function login(req, res) {
    const { email, senha } = req.body;

    if (!email || !senha) {
        logger.audit('Tentativa de Login Falhou: E-mail ou senha não fornecidos.', { email: email });
        return res.status(400).json({ erro: 'E-mail e senha são obrigatórios.' });
    }

    try {
        // 1. Busca o usuário pelo e-mail
        const userQuery = 'SELECT id, nome, email, senha_hash, role FROM Usuarios_Acesso WHERE email = $1';
        const result = await pool.query(userQuery, [email]);
        const usuario = result.rows[0];

        if (!usuario) {
            logger.audit('Tentativa de Login Falhou: Usuário não encontrado.', { email: email });
            return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
        }

        // 2. Compara a senha fornecida com o hash armazenado
        const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);

        if (!senhaValida) {
            logger.audit('Tentativa de Login Falhou: Senha incorreta.', { email: email, user_id: usuario.id });
            return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
        }

        // 3. Se a senha for válida, gera o token JWT
        const token = jwt.sign(
            { id: usuario.id, nome: usuario.nome, email: usuario.email, role: usuario.role },
            JWT_SECRET,
            { expiresIn: '8h' } // Token expira em 8 horas
        );

        // Auditoria de sucesso
        logger.audit(`Login de usuário de acesso realizado com sucesso.`, { 
            user_id: usuario.id, 
            user_nome: usuario.nome 
        });

        // 4. Retorna o token para o frontend
        res.status(200).json({ 
            mensagem: 'Login bem-sucedido',
            token: token,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                role: usuario.role
            }
        });

    } catch (error) {
        logger.error(`Erro durante o processo de login: ${error.message}`, { stack: error.stack, email: email });
        res.status(500).json({ erro: 'Erro interno do servidor durante o login.' });
    }
}

module.exports = {
    cadastrarUsuarioAcesso,
    login
};