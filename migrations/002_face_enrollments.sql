-- Migration 002: Face enrollment storage (Hybrid Face Auth Spec v2, §6)
--
-- Run this once against the Neon Postgres database used by this app
-- (the same DATABASE_URL as src/lib/db.ts). Requires the `vector` extension,
-- which Neon supports out of the box.
--
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS / CREATE OR
-- REPLACE / DROP ... IF EXISTS before CREATE TRIGGER).

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS face_enrollments (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    embedding      VECTOR(512) NOT NULL,
    model          TEXT        NOT NULL DEFAULT 'buffalo_sc',
    quality_score  FLOAT4,
    enrolled_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active      BOOLEAN     NOT NULL DEFAULT TRUE
);

-- Partial unique index, not a plain UNIQUE(user_id) constraint: only one
-- *active* enrollment per user is enforced. This is what makes soft-delete +
-- re-enrollment work — a soft-deleted row (is_active = FALSE) no longer
-- occupies the uniqueness slot, so INSERT ... reactivation logic in
-- face_api/db.py can create/replace an active row without a conflict.
DROP INDEX IF EXISTS face_enrollments_one_per_user; -- drop the old (buggy) v1 constraint if present
CREATE UNIQUE INDEX IF NOT EXISTS face_enrollments_one_active_per_user
    ON face_enrollments (user_id)
    WHERE is_active;

-- HNSW index for cosine similarity. Not required for today's one-to-one
-- lookup (a plain WHERE user_id = $1 doesn't need an ANN index at all), but
-- it's what verification queries use once face-as-primary-login needs a
-- many-to-many nearest-neighbor search. Tuned low (m=8) for the small
-- instance this runs against.
CREATE INDEX IF NOT EXISTS idx_face_embedding_hnsw
    ON face_enrollments
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 8, ef_construction = 32);

CREATE OR REPLACE FUNCTION update_face_enrollments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS face_enrollments_updated_at ON face_enrollments;
CREATE TRIGGER face_enrollments_updated_at
    BEFORE UPDATE ON face_enrollments
    FOR EACH ROW EXECUTE FUNCTION update_face_enrollments_updated_at();
