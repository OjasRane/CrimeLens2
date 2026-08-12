BEGIN;

CREATE TABLE IF NOT EXISTS provisioning_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_string VARCHAR UNIQUE NOT NULL,
    agent_id VARCHAR(50) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_burned BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS provisioning_tokens_agent_id_idx
    ON provisioning_tokens (agent_id);

CREATE INDEX IF NOT EXISTS provisioning_tokens_active_expiry_idx
    ON provisioning_tokens (expires_at)
    WHERE is_burned = FALSE;

ALTER TABLE provisioning_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE provisioning_tokens FROM anon, authenticated;

COMMIT;
