// db/config.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    // ===============================================
    // ATENÇÃO: Desative explicitamente o SSL para rodar localmente.
    ssl: false 
    // ou, se for necessário em alguns ambientes:
    // ssl: {
    //     require: false,
    //     rejectUnauthorized: false
    // }
    // O mais simples para local é: ssl: false
    // ===============================================
});

// Teste de conexão...
pool.connect((err, client, release) => {
    if (err) {
        // Agora, se houver erro, será de credenciais ou host, não SSL.
        return console.error('Erro ao conectar ao PostgreSQL:', err.stack);
    }
    console.log('✅ Conexão bem-sucedida com o PostgreSQL!');
    release();
});

module.exports = pool;