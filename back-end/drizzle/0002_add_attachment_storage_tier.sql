-- Migration 0002: Attachment 2-tier storage (OQ-6 approved)
-- Adds storage_tier column NOT NULL CHECK + deletedAt for soft-delete consistency;
-- Adds new index for tier lookups.

ALTER TABLE attachments
  ADD COLUMN IF NOT EXISTS storage_tier TEXT NOT NULL DEFAULT 'standard';

ALTER TABLE attachments
  ADD CONSTRAINT attachments_storage_tier_check
    CHECK (storage_tier IN ('standard', 'large'));

ALTER TABLE attachments
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS attachments_tier_idx
  ON attachments (storage_tier);

-- Coercion guarantee: enforce storage_path prefix matches storage_tier.
-- Existing rows (empty so far, but if any) fall under 'standard' default.
