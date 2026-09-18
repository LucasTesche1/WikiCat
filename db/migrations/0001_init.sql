-- Migration 0001: Schema inicial + FTS triggers
-- License: MIT

-- 1. Extensões
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tabelas
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
  theme_preference TEXT NOT NULL DEFAULT 'system' CHECK (theme_preference IN ('system', 'light', 'dark')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unq ON users (email);
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);

CREATE TABLE IF NOT EXISTS spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  description TEXT,
  color VARCHAR(7) NOT NULL DEFAULT '#6366f1',
  icon VARCHAR(32),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS spaces_slug_unq ON spaces (slug);
CREATE INDEX IF NOT EXISTS spaces_created_by_idx ON spaces (created_by);

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS tags_name_unq ON tags (LOWER(name));

CREATE TABLE IF NOT EXISTS pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES spaces(id),
  parent_page_id UUID REFERENCES pages(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  content_markdown TEXT NOT NULL DEFAULT '',
  draft_markdown TEXT,
  is_draft BOOLEAN NOT NULL DEFAULT FALSE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  fts_vector TSVECTOR,
  metadata JSONB
);
CREATE UNIQUE INDEX IF NOT EXISTS pages_space_slug_unq ON pages (space_id, slug);
CREATE INDEX IF NOT EXISTS pages_parent_idx ON pages (parent_page_id);
CREATE INDEX IF NOT EXISTS pages_fts_gin ON pages USING GIN (fts_vector);
CREATE INDEX IF NOT EXISTS pages_title_trgm_gin ON pages USING GIN (title gin_trgm_ops);

CREATE TABLE IF NOT EXISTS page_tags (
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (page_id, tag_id)
);

CREATE TABLE IF NOT EXISTS page_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  snapshot_markdown TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES users(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS page_versions_page_version_unq ON page_versions (page_id, version_number);
CREATE INDEX IF NOT EXISTS page_versions_author_idx ON page_versions (author_id);

CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes INTEGER NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS attachments_page_idx ON attachments (page_id);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_jti VARCHAR(64) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Função que recalcula fts_vector com pesos A/B/C/D
CREATE OR REPLACE FUNCTION wikicat_refresh_fts(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_title TEXT;
  v_content TEXT;
  v_tags TEXT;
  v_head TEXT;
  v_tail TEXT;
  v_vector TSVECTOR;
BEGIN
  SELECT
    COALESCE(p.title, ''),
    COALESCE(p.content_markdown, ''),
    COALESCE(STRING_AGG(t.name, ' ' ORDER BY t.name), '')
  INTO v_title, v_content, v_tags
  FROM pages p
  LEFT JOIN page_tags pt ON pt.page_id = p.id
  LEFT JOIN tags t ON t.id = pt.tag_id
  WHERE p.id = p_id
  GROUP BY p.id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_head := LEFT(v_content, 2000);
  v_tail  := CASE WHEN LENGTH(v_content) > 2000 THEN RIGHT(v_content, -2000) ELSE '' END;

  v_vector :=
    SETWEIGHT(TO_TSVECTOR('simple', COALESCE(v_title, '')), 'A') ||
    SETWEIGHT(TO_TSVECTOR('simple', COALESCE(v_tags, '')),  'B') ||
    SETWEIGHT(TO_TSVECTOR('simple', COALESCE(v_head, '')),  'C') ||
    SETWEIGHT(TO_TSVECTOR('simple', COALESCE(v_tail, '')),  'D');

  UPDATE pages SET fts_vector = v_vector WHERE id = p_id;
END;
$$;

-- 4. Trigger para atualizar FTS sempre que title ou content_markdown mudarem
CREATE OR REPLACE FUNCTION wikicat_pages_fts_trigger_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM wikicat_refresh_fts(NEW.id);
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (NEW.title IS DISTINCT FROM OLD.title) OR
       (NEW.content_markdown IS DISTINCT FROM OLD.content_markdown) THEN
      PERFORM wikicat_refresh_fts(NEW.id);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_pages_fts ON pages;
CREATE TRIGGER trg_pages_fts
AFTER INSERT OR UPDATE OF title, content_markdown ON pages
FOR EACH ROW
EXECUTE FUNCTION wikicat_pages_fts_trigger_fn();

-- 5. Trigger para regenerar FTS de página quando associação tag muda
CREATE OR REPLACE FUNCTION wikicat_page_tags_fts_trigger_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF (TG_OP IN ('INSERT', 'DELETE')) THEN
    v_id := COALESCE(NEW.page_id, OLD.page_id);
    PERFORM wikicat_refresh_fts(v_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_page_tags_fts ON page_tags;
CREATE TRIGGER trg_page_tags_fts
AFTER INSERT OR DELETE ON page_tags
FOR EACH ROW
EXECUTE FUNCTION wikicat_page_tags_fts_trigger_fn();

-- 6. Trigger updated_at para users e spaces (pages e outros já dependem de Drizzle $onUpdate)
CREATE OR REPLACE FUNCTION wikicat_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION wikicat_set_updated_at();

DROP TRIGGER IF EXISTS trg_spaces_updated_at ON spaces;
CREATE TRIGGER trg_spaces_updated_at
BEFORE UPDATE ON spaces
FOR EACH ROW
EXECUTE FUNCTION wikicat_set_updated_at();
