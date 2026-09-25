BEGIN;

ALTER TABLE homestays ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS ix_homestays_featured
  ON homestays(is_featured DESC, updated_at DESC)
  WHERE status = 'Approved';

COMMIT;
