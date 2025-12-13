-- Extensão para gerar UUIDs (opcional, mas recomendado para IDs)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabela de Usuários com Acesso ao Sistema (Login)
-- Não são os médicos, mas sim os administradores/operadores do app
CREATE TABLE Usuarios_Acesso (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL, -- Armazenará o hash da senha
    role VARCHAR(50) DEFAULT 'operador', -- Ex: admin, operador
    data_cadastro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabela de Unidades (Para o filtro e agendamento)
CREATE TABLE Unidades (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) UNIQUE NOT NULL,
    cidade VARCHAR(100),
    estado CHAR(2)
);

-- 3. Tabela de Médicos/Clientes (Cadastro Principal)
CREATE TABLE Medicos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(150) NOT NULL,
    crm VARCHAR(20) UNIQUE,
    cpf VARCHAR(14) UNIQUE,
    especialidade VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    telefone VARCHAR(20),
    empresa VARCHAR(100),
    unidade_padrao INT REFERENCES Unidades(id), -- Chave Estrangeira para a Unidade
    status_contrato VARCHAR(50) NOT NULL DEFAULT 'cobertura', -- Fixo ou Cobertura
    observacao TEXT,
    data_cadastro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabela de Agendamentos (Para a Integração)
CREATE TABLE Agendamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medico_id UUID REFERENCES Medicos(id) NOT NULL, -- Chave Estrangeira para o Médico
    unidade_agendada INT REFERENCES Unidades(id) NOT NULL,
    data_integracao DATE NOT NULL,
    horario TIME NOT NULL,
    retorno BOOLEAN DEFAULT FALSE,
    pals BOOLEAN DEFAULT FALSE,
    acls BOOLEAN DEFAULT FALSE,
    status_agendamento VARCHAR(50) NOT NULL DEFAULT 'Pendente', -- Pendente, Confirmado, Concluído
    token_confirmacao VARCHAR(255) UNIQUE, -- Para o link de confirmação via e-mail/WhatsApp
    presenca VARCHAR(50) DEFAULT 'Não Informada', -- Presente, Ausente, Não Informada
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);