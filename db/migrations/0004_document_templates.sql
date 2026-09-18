CREATE TABLE IF NOT EXISTS document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(120) NOT NULL,
  title VARCHAR(160) NOT NULL,
  description TEXT,
  content_markdown TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS document_templates_key_unq
  ON document_templates(key)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS document_templates_title_unq
  ON document_templates(lower(title))
  WHERE deleted_at IS NULL;

INSERT INTO document_templates (key, title, description, content_markdown, is_system)
VALUES
('blank', 'Blank page', 'Start from an empty document.', '', TRUE),
('runbook', 'Operational runbook', 'Procedure, validation, and rollback sections.', '## Objective

Describe the expected outcome.

## Preconditions

- [ ] Verify the environment and permissions

> [!WARNING]
> Confirm the environment before running commands.

## Procedure

1. Describe the first step.

## Validation

Describe how to verify the result.

## Rollback

Describe how to reverse the change.
', TRUE),
('architecture', 'Architecture decision', 'Decision record with context and consequences.', '## Context

What problem needs to be solved?

## Decision

Describe the decision and considered alternatives.

## Consequences

Record benefits, limitations, and dependencies.
', TRUE)
ON CONFLICT DO NOTHING;
