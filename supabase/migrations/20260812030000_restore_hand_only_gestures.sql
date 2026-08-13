BEGIN;

UPDATE kinetic_signatures
SET signature_version = 2
WHERE signature_version = 3;

ALTER TABLE kinetic_signatures
    DROP COLUMN IF EXISTS motion_vector;

ALTER TABLE kinetic_signatures
    DROP CONSTRAINT IF EXISTS kinetic_signatures_signature_version_check;

ALTER TABLE kinetic_signatures
    ADD CONSTRAINT kinetic_signatures_signature_version_check
    CHECK (signature_version IN (1, 2));

COMMIT;
