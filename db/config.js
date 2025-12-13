// db/config.js
const { Pool } = require('pg');
require('dotenv').config();

// 1. Prioriza a URL de Conexão Completa (Padrão de Prod/Heroku)
const connectionString = process.env.DATABASE_URL;

// 2. Configurações de SSL (Necessário para a AWS RDS em produção)
const sslConfig = connectionString 
    ? {
        // Se estiver em ambiente de produção (usando DATABASE_URL), force SSL
        ssl: {
            rejectUnauthorized: false // Permite conexões sem verificação estrita de certificado
        }
    } 
    : {
        // Se estiver em ambiente de desenvolvimento (sem DATABASE_URL), desative SSL
        ssl: false
    };

// 3. Objeto de Configuração para o Pool
const poolConfig = connectionString 
    ? {
        // Opção A: Usar a URL completa (Produção)
        connectionString: connectionString,
        ...sslConfig
    } 
    : {
        // Opção B: Usar variáveis separadas (Desenvolvimento Local)
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_DATABASE,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
        ...sslConfig
    };


// Inicialização do Pool com a configuração flexível
const pool = new Pool(poolConfig);


// Teste de conexão...
pool.connect((err, client, release) => {
    if (err) {
        return console.error('❌ Erro ao conectar ao PostgreSQL. Verifique credenciais e SSL:', err.stack);
    }
    console.log('✅ Conexão bem-sucedida com o PostgreSQL!');
    release();
});

module.exports = pool;
