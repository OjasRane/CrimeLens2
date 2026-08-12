BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(50) UNIQUE NOT NULL,
    clearance_level VARCHAR(20) DEFAULT 'RED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kinetic_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(50) NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
    signature_vector JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT kinetic_signatures_vector_is_valid CHECK (
        CASE
            WHEN jsonb_typeof(signature_vector) = 'array'
                THEN jsonb_array_length(signature_vector) = 63
            ELSE FALSE
        END
    )
);

CREATE INDEX IF NOT EXISTS kinetic_signatures_agent_id_idx
    ON kinetic_signatures (agent_id);

COMMIT;
