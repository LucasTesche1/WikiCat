-- Migration 0003: Sistema de Tags por espaço + trigger FTS peso B em nomes das tags
-- License: MIT
-- Dependências: 0001_init, 0002_add_attachment_storage_tier

-- 1. Drop tabelas antigas (recriamos por completo com novo escopo por espaço)
DROP TABLE IF EXISTS page_tags CASCADE;
DROP TABLE IF EXISTS tags CASCADE;

-- 2. Nova tabela tags (escopo por espaço)
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  name VARCHAR(64) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#6366f1',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT tags_name_check CHECK (name ~ '^[A-Za-z0-9À-ÖØ-öø-ÿ\s\-_]{2,64}$'),
  CONSTRAINT tags_color_check CHECK (color ~* '^#(?:[0-9a-fA-F]{3}){1,2}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS tags_space_name_unq
  ON tags (space_id, LOWER(name))
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS tags_space_idx ON tags (space_id);
CREATE INDEX IF NOT EXISTS tags_name_trgm_gin ON tags USING GIN (name gin_trgm_ops);

-- 3. Nova tabela page_tags (N:M, PK composta)
CREATE TABLE IF NOT EXISTS page_tags (
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (page_id, tag_id)
);
CREATE INDEX IF NOT EXISTS page_tags_tag_idx ON page_tags (tag_id);

-- 4. Coluna denormalizada pages.tag_names_denorm (uso futuro + debug)
ALTER TABLE pages ADD COLUMN IF NOT EXISTS tag_names_denorm TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS pages_tag_names_trgm_gin ON pages USING GIN (tag_names_denorm gin_trgm_ops);

-- 5. Função FTS atualizada: considera tags.deleted_at e soft delete em geral, pesos Título(A) / Tags(B) / início conteúdo(C) / resto(D)
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
  v_denorm TEXT;
BEGIN
  SELECT
    COALESCE(p.title, ''),
    COALESCE(p.content_markdown, ''),
    COALESCE(STRING_AGG(LOWER(t.name), ' ' ORDER BY t.name), ''),
    COALESCE(STRING_AGG(t.name, ',' ORDER BY t.name), '')
  INTO v_title, v_content, v_tags, v_denorm
  FROM pages p
  LEFT JOIN page_tags pt ON pt.page_id = p.id
  LEFT JOIN tags t ON t.id = pt.tag_id AND t.deleted_at IS NULL
  WHERE p.id = p_id
  GROUP BY p.id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_head := LEFT(v_content, 2000);
  v_tail := CASE WHEN LENGTH(v_content) > 2000 THEN RIGHT(v_content, -2000) ELSE '' END;

  v_vector :=
    SETWEIGHT(TO_TSVECTOR('simple', COALESCE(v_title, '')), 'A') ||
    SETWEIGHT(TO_TSVECTOR('simple', COALESCE(v_tags, '')),  'B') ||
    SETWEIGHT(TO_TSVECTOR('simple', COALESCE(v_head, '')),  'C') ||
    SETWEIGHT(TO_TSVECTOR('simple', COALESCE(v_tail, '')),  'D');

  UPDATE pages
  SET fts_vector = v_vector,
      tag_names_denorm = v_denorm
  WHERE id = p_id;
END;
$$;

-- 6. Trigger página: atualiza FTS quando title ou content mudarem
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

-- 7. Trigger page_tags: regen FTS quando associação muda
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

-- 8. Trigger updated_at para tags
CREATE OR REPLACE FUNCTION wikicat_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tags_set_updated_at ON tags;
CREATE TRIGGER trg_tags_set_updated_at
BEFORE UPDATE ON tags
FOR EACH ROW
EXECUTE FUNCTION wikicat_set_updated_at();

-- 9. Backfill: rodar wikicat_refresh_fts em todas as páginas existentes
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM pages WHERE deleted_at IS NULL ORDER BY id LOOP
    PERFORM wikicat_refresh_fts(r.id);
  END LOOP;
END;
$$;
