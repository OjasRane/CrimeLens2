BEGIN;

ALTER TABLE kinetic_signatures
    ADD COLUMN IF NOT EXISTS signature_version SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE kinetic_signatures
    DROP CONSTRAINT IF EXISTS kinetic_signatures_signature_version_check;

ALTER TABLE kinetic_signatures
    ADD CONSTRAINT kinetic_signatures_signature_version_check
    CHECK (signature_version IN (1, 2));

COMMIT;
