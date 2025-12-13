// log/logger.js
const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');

const { combine, timestamp, printf, colorize } = format;

// Garante que o diretório de log exista
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// Formato personalizado para o log
const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
    let logMessage = `${timestamp} [${level}]: ${message}`;

    // Adiciona metadados (como detalhes da auditoria) se existirem
    if (Object.keys(metadata).length > 0) {
        // Remove a propriedade 'stack' (trace de erro) para logs de INFO e AUDIT
        const cleanMetadata = { ...metadata };
        if (cleanMetadata.stack) delete cleanMetadata.stack;
        
        logMessage += ` | ${JSON.stringify(cleanMetadata)}`;
    }
    return logMessage;
});

const logger = createLogger({
    level: 'info', // Nível mínimo para ser registrado (erros, avisos, info e audit)
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
    ),
    transports: [
        // 1. Transporte para Arquivo (Loga TUDO: info, audit, error, etc.)
        new transports.File({ 
            filename: path.join(logDir, 'app_log.log'),
            level: 'debug', // Salva no arquivo a partir do nível 'debug'
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // 2. Transporte para o Console (Loga com cores)
        new transports.Console({
            level: 'debug', // Exibe no console a partir do nível 'debug'
            format: combine(
                colorize(), // Adiciona cores ao console
                logFormat
            )
        }),
    ],
    // Adicione um transporte separado para logs de erro críticos (opcional)
    // new transports.File({ 
    //     filename: path.join(logDir, 'error.log'),
    //     level: 'error'
    // }),
});

// Alias para facilitar o log de auditoria
logger.audit = (message, metadata = {}) => {
    logger.info(message, { type: 'AUDIT', ...metadata });
};

module.exports = logger;