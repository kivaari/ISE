DROP TABLE IF EXISTS resolutions, evidences, disputes, metrics_snapshots, telemetry_sessions, access_credentials, escrow_transactions, bookings, availability_schedules, reputations, hardware_specs, nodes, verifications, wallets, users;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id),
    balance DECIMAL(12, 2) DEFAULT 0.00,
    frozen_amount DECIMAL(12, 2) DEFAULT 0.00,
    currency CHAR(3) DEFAULT 'RUB'
);

CREATE TABLE nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'offline',
    category VARCHAR(50) DEFAULT 'ml',
    price_per_hour DECIMAL(8, 2) NOT NULL,
    rating DECIMAL(2,1) DEFAULT 4.5,
    description TEXT,
    region VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE hardware_specs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID UNIQUE REFERENCES nodes(id),
    cpu_model VARCHAR(100),
    ram_gb INT,
    gpu_model VARCHAR(100),
    gpu_vram_gb INT,
    disk_type VARCHAR(10),
    disk_gb INT
);

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES users(id),
    node_id UUID REFERENCES nodes(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    total_amount DECIMAL(10, 2) DEFAULT 0.00,
    idempotency_key UUID UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE escrow_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id),
    amount DECIMAL(10, 2),
    status VARCHAR(20) DEFAULT 'hold',
    idempotency_key UUID UNIQUE
);

CREATE TABLE access_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID UNIQUE REFERENCES bookings(id),
    ssh_login VARCHAR(50),
    ssh_pass VARCHAR(50),
    ip_address VARCHAR(50),
    port INT DEFAULT 22
);

CREATE TABLE telemetry_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID REFERENCES nodes(id),
    booking_id UUID REFERENCES bookings(id),
    status VARCHAR(20) DEFAULT 'active',
    started_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE metrics_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telemetry_session_id UUID REFERENCES telemetry_sessions(id),
    timestamp_sec INT,
    cpu_load DECIMAL(5,2),
    ram_used_mb INT,
    gpu_temp DECIMAL(5,2),
    disk_io INT
);

CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id),
    status VARCHAR(20) DEFAULT 'open',
    resolution VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO users (id, email, role) VALUES 
('a1b2c3d4-0001-0001-0001-000000000001', 'client@demo.com', 'client'),
('a1b2c3d4-0002-0002-0002-000000000002', 'provider@demo.com', 'provider');

INSERT INTO wallets (user_id, balance, frozen_amount) VALUES 
('a1b2c3d4-0001-0001-0001-000000000001', 0.00, 0.00),
('a1b2c3d4-0002-0002-0002-000000000002', 0.00, 0.00);