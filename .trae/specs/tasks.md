# WikiCat - Implementation Plan

UI implementation completion update 2026-09-14:

- Status: completed.
- Evidence: `docs/ui-implementation.md`.
- Passed: `tsc -p packages/shared/tsconfig.build.json`.
- Passed: `tsc -p apps/api/tsconfig.build.json`.
- Passed: `tsc -p apps/web/tsconfig.json`.
- Passed: `pnpm -r build`.
- Passed: `node docs/verify-blueprint.cjs --syntax`.
- Passed: `node docs/ui-smoke-test.mjs`.
- Deferred release gates: live database integration, authenticated browser flows, and full manual accessibility audit in the target environment.

## UI-2026-09-13 — Workspace redesign

- Status: completed. Authorized by user's “Implement” instruction.
- Requirements: UI-01–UI-06; design: `docs/ui-ux-blueprint-v2.md`.
- Priority: high. Dependencies: existing authentication/page/tag/attachment contracts.
- Order: safe Markdown and save coordination → tokens/shared shell → reader/search
  → history/relations/checkpoints → verification.
- TR rule: web/API/shared typechecks and web production build succeed.
- TR rule: automated safety/anchor/diff/save tests pass; verify authenticated UI with
  fixture data when local database is unavailable and identify fixture-based evidence.
- TR rule: role gates, uploads, deep links, mobile drawer, palette keyboard behavior,
  source preservation and no fabricated telemetry verified.
- TR rubric: AAA remains a release gate requiring full manual assistive-tech audit.
- Evidence recorded in `docs/ui-implementation.md`; checks listed in the completion update above.


---

## Regras Fundamentais de Execução (SDD + Zero Paid Tools)

1. **Spec Driven Development é obrigatório**. Antes de iniciar **qualquer** tarefa abaixo:
   - Confirme que o requisito correspondente existe em `spec.md` e está vinculado por AC na seção "Acceptance Criteria Addressed".
   - Se a tarefa exige mudar comportamento/escopo já descrito no spec → **PARE**, atualize o spec, peça aprovação do usuário, atualize os ACs, **só depois** execute a tarefa.
   - Nenhum TR (Test Requirement) de tarefa pode ser marcado como `passed` sem evidência concreta (saída de comando, screenshot, relatório de teste).
2. **Auditoria de licenças FLOSS contínua**: Antes de adicionar qualquer nova dependência npm/pip/apk no projeto, valide que sua licença é: MIT, Apache-2.0, BSD, ISC, PostgreSQL, MPL-2.0, ou compatível. **Proibido**: GPL forte (exige que todo o projeto seja GPL), licenças comerciais, dependências que exijam subscription para uso em produção. Ao final, a Tarefa 16 faz varredura completa.
3. **Nenhuma integração externa paga é permitida**. Se uma funcionalidade aparentemente "só existe em API paga" (ex: busca por IA, tradução, auth social), reescreva usando alternativa FLOSS self-hosted ou remova da v1.
4. **Todo código novo deve ter TR definido**. Se você criar um componente/endpoint novo que não tem TR na task original → atualize a task antes de codar.

---

## Fase 0 — Scaffolding do Projeto e Containerização

## Task 1: Inicializar monorepo, configurações base e contrato de tipos
- **Status**: `completed`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Criar estrutura monorepo (pnpm workspaces): `apps/web` (frontend React + Vite), `apps/api` (backend Fastify), `packages/shared` (tipos TypeScript compartilhados de API)
  - Configurar TypeScript base com `strict: true` em todos os pacotes
  - Configurar ESLint + Prettier regras compartilhadas
  - Criar arquivo de contrato: `packages/shared/src/api-contract.ts` com tipos das entidades (User, Space, Page, PageVersion, Tag, Attachment) e DTOs de request/response das rotas iniciais
  - Configurar `.gitignore`, `.editorconfig`, `README` inicial do repositório
- **Acceptance Criteria Addressed**: NFR-4 (monorepo e contrato de tipos compartilhado)
- **Test Requirements**:
  - `rule` TR-1.1: Executar `pnpm typecheck` em todo workspace e retornar 0 erros. Evidence: saída do comando.
  - `rule` TR-1.2: Frontend importa tipo `Page` de `@wikicat/shared` e compila sem erros de tipo. Evidence: resultado do build do frontend.
  - `rubric` TR-1.3: Organização do monorepo; escala 1-5; 1=pastas bagunçadas, 3=separação aceitável, 5=estrutura limpa, separação clara de responsabilidades, nomeação consistente; threshold >= 4; Evidence: revisão de estrutura por árvore de diretórios.
- **Completion Evidence**:
  - TR-1.1 (rule): `pnpm typecheck` executado em 2026-09-07 — Scope 3/3 packages (`@wikicat/shared`, `@wikicat/api`, `@wikicat/web`), todos retornaram `Done`, exit code 0.
  - TR-1.2 (rule): `vite build` executado em `apps/web` — built in 1.75s, 0 erros de tipo. `App.tsx` importa `type { Page }` de `@wikicat/shared` e utiliza `Pick<Page, ...>` para estrutura de exemplo.
  - TR-1.3 (rubric): score 5/5; estrutura `apps/api + apps/web + packages/shared` separa responsabilidades (API / SPA / contrato compartilhado). Configs de tsconfig.base, .eslintrc, .prettierrc, pnpm-workspace.yaml, .gitignore, .editorconfig presentes na raiz; nomenclatura consistente com prefixo `@wikicat/*` em workspaces.
- **Notes**: Em ambientes com sandbox bloqueando corepack global, rodar pnpm via `node node_modules/.ignored/pnpm/bin/pnpm.cjs` (pnpm instalado como devDependency raiz).

## Task 2: Configurar Drizzle ORM + schema Postgres e conexão
- **Status**: `in_progress`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - Instalar `drizzle-orm`, `postgres`, `drizzle-kit` em `apps/api`
  - Criar schema inicial: `users`, `spaces`, `pages` (com `parent_page_id` self-FK, `content_markdown`, `fts_vector` tsvector), `page_versions`, `tags`, `page_tags` (N:N), `attachments`, `auth_tokens` (lista negra JWT opcional)
  - Definir triggers de auto-update de `fts_vector` via Postgres trigger + function (quando `title` ou `content_markdown` mudam, regenera tsvector com pesos: título peso 'A', tags peso 'B', início conteúdo peso 'C', resto peso 'D')
  - Adicionar índice GIN em `pages.fts_vector` e índice GIN pg_trgm em `pages.title` para busca parcial
  - Criar migration inicial (0001_init.sql)
  - Adicionar extensão `pg_trgm` no schema
- **Acceptance Criteria Addressed**: FR-2, FR-3, FR-7 (base de dados); AC-3 (índices FTS)
- **Test Requirements**:
  - `rule` TR-2.1: Rodar `pnpm --filter api db:migrate` em banco vazio, depois consultar `information_schema.tables` e encontrar todas as 7 tabelas + 2 índices GIN. Evidence: saída SQL.
  - `rule` TR-2.2: Inserir página com título "Backup Postgres" e conteúdo com "sudo pg_dump", executar query FTS com `plainto_tsquery('postgres backup')` e retornar a página com rank > 0. Evidence: resultado da query.
- **Completion Evidence (parcial; TR-2.1/TR-2.2 a finalizar após Task 3 com Postgres em contêiner)**:
  - Preparação: `drizzle.config.ts` criado, `src/db/schema/index.ts` com 8 tabelas, `src/db/index.ts` registra `registerDb` plugin Fastify, `src/db/migrate.ts` executor de migrations com tabela `_drizzle_migrations`, migration `drizzle/0001_init.sql` com CREATE EXTENSION pg_trgm, 8 tabelas, função `wikicat_refresh_fts` pesos A/B/C/D + triggers `trg_pages_fts`, `trg_page_tags_fts`, e `trg_*_updated_at`.
  - Sanity check: regex match em migration SQL = 8 CREATE TABLE (1 cada), 1 pg_trgm, 1 GIN pages_fts_gin, 1 GIN pages_title_trgm_gin, 4 ocorrências de `wikicat_refresh_fts`, 2 de `trg_pages_fts`.
  - Typecheck monorepo: `pnpm typecheck` exit 0, com schema, plugin db e migrate.ts.
- **Notes**: Validação de migrations com contêiner Postgres (TR-2.1/TR-2.2) será executada imediatamente após a inicialização do podman-compose na Task 3, para evitar dois startups separados do DB. Em Task 3 é adicionada uma etapa de "migrate + seed + query FTS de exemplo" como passo do healthcheck integrado.

## Task 3: Dockerfile multi-stage + podman-compose + healthchecks
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1, Task 2
- **Description**:
  - Escrever `Dockerfile` raiz multi-stage: (1) `builder-deps` instala pnpm e dependências, (2) `builder-web` builda frontend Vite, (3) `builder-api` compila Fastify, (4) `runner` usa `node:22-bookworm-slim`, cria usuário não-root, copia estáticos do front e código transpilado do back
  - Criar `.dockerignore` abrangente
  - Criar `podman-compose.yml` com 3 serviços: (a) `db` (postgres:16-alpine, volume wikicat-db-data, healthcheck via `pg_isready`), (b) `app` (imagem construída, portas 3000:3000, healthcheck em GET /health, **2 volumes attachments separados**: `wikicat-attachments` montado em `/attachments` (tier standard ≤20MB) + `wikicat-attachments-large` montado em `/attachments-large` (tier large), env-file .env), (c) `proxy` (caddy:2-alpine, Caddyfile com reverse_proxy para app:3000, TLS autoassinado ou certificado da CA via volume, gzip). 5 volumes nomeados total: wikicat-db-data, wikicat-attachments, wikicat-attachments-large, wikicat-caddy-data, wikicat-caddy-config.
  - Criar `.env.example` com **todas** variáveis documentadas (incluindo OQ-6 respondida): `DATABASE_URL`, `JWT_SECRET`, `SESSION_MAX_AGE`, `ATTACHMENTS_DIR=/attachments`, `ATTACHMENTS_LARGE_DIR=/attachments-large`, `MAX_ATTACHMENT_STANDARD_MB=20`, `MAX_ATTACHMENT_LARGE_MB=2048`, `PUBLIC_BASE_URL`, `CADDY_DOMAIN`, `INIT_ADMIN_EMAIL`, `INIT_ADMIN_PASSWORD`, `INIT_ADMIN_NAME`.
  - Documentar `docs/deploy.md` passo a passo: clone → cópia .env → `podman-compose up -d --build` → `pnpm --filter api db:migrate` rodando dentro do contêiner → backup via `podman exec wikicat-db pg_dump ...` **+** dois backups separados: attachments standard (volume wikicat-attachments) e attachments large (volume wikicat-attachments-large em disco dedicado).
- **Acceptance Criteria Addressed**: NFR-2 (deploy via Podman, volumes separados attachments, backup); AC-5
- **Test Requirements**:
  - `rule` TR-3.1: Build com `podman build -t wikicat-app .` retorna exit code 0 e imagem final tem < 350MB. Evidence: `podman images` output.
  - `rule` TR-3.2: Deploy do zero com `podman-compose up -d --build`, aguardar 90s, `podman ps` mostra 3 contêineres `(healthy)`, `curl https://$CADDY_DOMAIN/health` retorna {"status":"ok"}. Evidence: saídas dos comandos.
  - `rule` TR-3.3: `podman exec -it wikicat-db psql` insere linha, restart do contêiner com `podman-compose restart db`, consulta novamente e linha persiste. Evidence: antes/depois do restart.
  - `rule` TR-3.4: `podman volume ls` mostra 5 volumes nomeados. `podman inspect wikicat-app` mostra 2 mounts distintos: (a) source wikicat-attachments → target `/attachments` e (b) source wikicat-attachments-large → target `/attachments-large`. Evidence: saídas `podman volume ls` e `podman inspect -f '{{.Mounts}}' wikicat-app` mostrando os 2 paths diferentes.

---

## Fase 1 — Autenticação, Espaços e Usuários

## Task 4: Autenticação local (cadastro/login/logout) com JWT e roles
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - Rotas Fastify: `POST /api/auth/register` (apenas admin cria novos usuários na v1 — auto-criar primeiro admin via seed `INIT_ADMIN_EMAIL/SENHA` no env), `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
  - bcryptjs para hash de senha (cost 12)
  - Plugin fastify/jwt + fastify/cookie: JWT em cookie HttpOnly/Secure/SameSite=Lax
  - Guard `requireRole(roles: Role[])` para proteger rotas
  - Seed de inicialização: se 0 usuários no banco e INIT_ADMIN_EMAIL definido, criar admin
  - Prevenção de enumeração de usuários: mesma mensagem de erro genérica em login falho
- **Acceptance Criteria Addressed**: FR-1, NFR-3; AC-1 (base)
- **Test Requirements**:
  - `rule` TR-4.1: Chamar `/register` sem token retorna 401; como admin cria editor e viewer; login de cada um retorna JWT válido em cookie; `/me` retorna dados corretos. Evidence: testes unitários de API (Vitest).
  - `rule` TR-4.2: Tentar editar página como viewer retorna 403. Evidence: teste de rota.
  - `rule` TR-4.3: Senha do usuário armazenada no banco inicia com prefixo `$2b$12$`. Evidence: select direto no banco.

## Task 5: CRUD de Espaços
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 4
- **Description**:
  - CRUD backend: `GET /api/spaces`, `GET /api/spaces/:slug`, `POST /api/spaces` (admin), `PATCH /api/spaces/:id` (admin), `DELETE /api/spaces/:id` (admin — soft delete via `deleted_at`, cascade nas páginas? No: marcar páginas também)
  - Campos: `name`, `slug` (único, validado com regex slug), `description`, `color` (hex), `icon` (emoji ou nome de ícone), `created_by`
  - Validação via JSON Schema no Fastify (ajuste para 3-50 chars, slug não pode ser palavra reservada como "admin", "settings", "api")
- **Acceptance Criteria Addressed**: FR-2
- **Test Requirements**:
  - `rule` TR-5.1: Listar, criar, editar, deletar soft via API respeitando role. Evidence: testes de integração.
  - `rule` TR-5.2: Criar espaço com slug duplicado retorna 409 Conflict. Evidence: teste.

## Task 6: UI de Autenticação + Sidebar + Navbar + Dashboard inicial
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 4, Task 5
- **Description**:
  - Página `/login` com shadcn/ui Card, formulário e-mail/senha, validação client-side (React Hook Form + Zod). Mensagens de erro amigáveis.
  - Protected route wrapper (via React Router + context de auth com hook `useAuth()`)
  - Layout app shell: Navbar superior (logo WikiCat, busca global `Ctrl+K` modal esqueleto, menu do usuário dropdown). Sidebar esquerdo (lista de espaços com cor/ícone, count de páginas, link ativo). Content principal central com padding.
  - Dashboard inicial `/`: grid de espaços cards + "Recentes" (últimas 5 páginas visitadas/editadas pelo usuário — endpoint `GET /api/pages/recent`)
  - Tema claro/escuro com next-themes (ou `zustand` + localStorage se não usar Next.js — Vite vanilla). Botão de troca de tema no navbar.
- **Acceptance Criteria Addressed**: FR-9 (perfil básico), NFR-5, NFR-6; AC-8 (base de temas)
- **Test Requirements**:
  - `rule` TR-6.1: Usuário não logado acessa `/` → redireciona para `/login`. Loga → redireciona de volta. Evidence: Playwright.
  - `rubric` TR-6.2: Qualidade visual/layout; escala 1-5; 1=quebrado, 3=usável, 5=espelhando referências de Confluence/Notion-lite com alinhamento, espaçamento, tipografia consistente; threshold >= 4; Evidence: screenshot das 3 telas principais.

---

## Fase 2 — Páginas, Editor e Busca

## Task 7: CRUD de Páginas e árvore hierárquica
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 5
- **Description**:
  - Backend rotas: `GET /api/spaces/:slug/pages/tree` (retorna estrutura aninhada completa do espaço para sidebar), `GET /api/pages/:id` (detalhe + autor + data + tags + attachments), `POST /api/spaces/:slug/pages` (cria, aceita `parent_page_id` opcional e `order_index`), `PATCH /api/pages/:id` (atualiza título, ordem, parent — mover página), `DELETE /api/pages/:id` (soft delete)
  - Ao mover página entre pais ou reordenar, validar que não cria ciclo na árvore (BFS/DFS check)
  - Trigger de atualização de FTS dispara ao salvar
- **Acceptance Criteria Addressed**: FR-3; AC-1 (edição)
- **Test Requirements**:
  - `rule` TR-7.1: Criar 3 níveis de hierarquia (Raiz > Filha > Neta). Árvore retornada pela API tem estrutura aninhada correta. Evidence: assert no JSON.
  - `rule` TR-7.2: Tentar mover Neta como pai de Raiz retorna erro 400 "Ciclo detectado". Evidence: teste.

## Task 8: Integração Editor TipTap WYSIWYG + persistência de página + anexos 2-tiers
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 7
- **Description**:
  - Instalar TipTap + extensões: StarterKit, Link, Image, Table, Placeholder, CodeBlock (Shiki highlight), TaskList, Underline, Highlight
  - Componente `<WikiEditor content={markdown} onChange={fn} />` com toolbar completa (negrito, itálico, H1-H3, lista, code inline, bloco de código com linguagem, tabela, link, imagem, undo/redo)
  - Botão "copiar código" em cada bloco de código renderizado (componente custom CodeBlockRenderer)
  - Modo toggle WYSIWYG ↔ Markdown bruto: `<textarea>` com highlight via prism-react-renderer e botão "Alternar visualização"
  - Auto-save: debounce 3s, PATCH `/api/pages/:id/draft` (campo `draft_markdown` na tabela pages, separado de `content_markdown` publicado). Badge "Rascunho salvo HH:MM" no editor.
  - **Sem workflow de revisão** (confirmado OQ-4): ações editor/admin publicam direto; não há estados "pendente de aprovação".
  - **Sistema de anexos em 2 tiers** (confirmado OQ-6):
    1. **Tier standard** (inline no editor): Upload drag-and-drop de imagem / pequenos anexos → **`POST /api/pages/:id/attachments`** (multipart/form-data). Valida: role editor/admin, MIME whitelist (`image/*`, `application/pdf`, `application/json`, `text/*`, `application/zip`, `application/x-gzip`), tamanho ≤ `MAX_ATTACHMENT_STANDARD_MB` (20MB default). Salva em **`wikicat-attachments`** (`/attachments/:spaceId/:pageId/:uuid.ext`). Retorna URL para TipTap renderizar inline ou como link.
    2. **Tier large** (modal dedicado, fora do drag-drop inline): Botão toolbar "Anexar arquivo grande" → modal upload. Envia para **`POST /api/pages/:id/attachments/large`** (multipart/form-data, valida `Content-Length` ≤ `MAX_ATTACHMENT_LARGE_MB` / 2048MB default **antes** de receber stream). Whitelist MIME/ext: `.iso`, `.tar`, `.tar.gz`, `.tgz`, `.zip`, `.sql`, `.ova`, `.img`, `.qcow2`, `.rpm`, `.deb`, `.pkg`. Role editor/admin. Salva em volume **`wikicat-attachments-large`** — diretório `/attachments-large/:spaceId/:pageId/:uuid.ext`. **NUNCA compartilha pasta com tier standard.** Insere no banco com `attachments.storage_tier = 'large'`.
  - **Schema attachments**: Nova coluna `storage_tier` text check IN ('standard' | 'large'). `storage_path` começa com `/attachments/` quando standard, com `/attachments-large/` quando large. Backend valida coerência: se `storage_tier='large'` path deve começar com `/attachments-large/`. Garantia de isolamento anti-fuga.
  - Rota download: `GET /api/attachments/:id/download`. Lê `storage_tier` para resolver raiz do volume correto; adiciona header `Content-Disposition attachment; filename="originalName"`. Role viewer consegue download.
  - Renderizador de página visualizada: `<PageRenderer markdown={...} />` com TOC automático (gera a partir de headings via remark/rehype), breadcrumb, e link para modo de edição. Anexos large são exibidos como card destacado (tamanho em human-readable + ícone ISO/dump + botão download) para diferenciar de anexos standard inline.
- **Acceptance Criteria Addressed**: FR-4 (inclui 2 tiers de anexos + sem workflow OQ-4), FR-5; AC-2
- **Test Requirements**:
  - `rule` TR-8.1: Digitar H1 + parágrafo + bloco bash "ls -la" via interface WYSIWYG, salvar, recarregar página. Markdown armazenado tem exatos 3 blocos (`#`, `p`, ```bash). Bloco renderizado em tela contém botão "Copiar" e ao clicar, JS retorna "ls -la" via `navigator.clipboard`. Evidence: Playwright.
  - `rule` TR-8.2: Upload de 2MB PNG drag-drop via rota `/attachments` standard → arquivo salvo em `/attachments/:spaceId/:pageId/:uuid.png` (**NÃO** em /attachments-large) e banco tem linha em `attachments` com `storage_tier='standard'`. Evidence: ls filesystem + select SQL com assert storage_tier.
  - `rule` TR-8.3: Auto-save ativado após digitação + 3s sem ação. Bandeira `is_draft = true` muda para false após "Publicar". Evidence: checagem de campos via API.
  - `rule` TR-8.4: Upload de arquivo 512MB `backup-postgres.sql` via rota `/attachments/large`: (a) `Content-Length` válido 536870912 → aceito, salvo em `/attachments-large/:spaceId/:pageId/:uuid.sql`, banco linha com `storage_tier='large'`. (b) Mesmo arquivo enviado para `/attachments` (standard, 20MB limit) → retorna 413 Payload Too Large com mensagem amigável "Arquivo excede 20MB do tier standard; use modal de anexo grande". (c) Arquivo 3GB enviado para `/attachments/large` com `Content-Length > MAX_ATTACHMENT_LARGE_MB * 1024 * 1024` → **rejeitado antes de iniciar streaming de dados** (backend checa header primeiro). Evidence: logs request + asserts HTTP status + paths corretos.
  - `rubric` TR-8.5: Isolamento rigoroso de tiers; escala 1-5; 1=paths compartilhados ou fuga possível, 3=paths separados mas nenhuma validação de coerência, 5=2 volumes Podman nomeados distintos + 2 pontos de montagem separados no contêiner + coluna storage_tier NOT NULL CHECK + validação de path no backend + downloads resolvem raiz por tier; threshold >= 5; Evidence: ls dois diretórios vazios separados em volume + schema SQL attachment tem `storage_tier text NOT NULL CHECK (storage_tier IN ('standard','large'))` + código backend `attachments.service.ts` valida path vs tier antes de write.

## Task 9: Sistema de Tags
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 7
- **Description**:
  - Backend: `GET /api/tags` (lista todas ordenadas por uso), `POST /api/pages/:id/tags` adiciona tag (se não existe cria). `DELETE /api/pages/:id/tags/:tagName` remove associação.
  - UI: no rodapé do editor, input de tags com autocomplete (ao digitar "@" ou campo dedicado). Chips clicáveis filtram páginas por tag.
  - Página `/tag/:name`: lista todas as páginas com tal tag, ordenadas por última edição
  - Atualizar trigger FTS para incluir nomes de tags concatenados como peso 'B'
- **Acceptance Criteria Addressed**: FR-3 (tags), FR-6 (busca por tags)
- **Test Requirements**:
  - `rule` TR-9.1: Adicionar 3 tags em página, recarregar → tags aparecem. Remover 1 → 2 restam. Evidence: API + UI.
  - `rule` TR-9.2: Busca por tag retorna página mesmo que termo não esteja nem em título nem conteúdo. Evidence: teste FTS no Postgres.

## Task 10: Busca Global (Ctrl+K) com Postgres FTS
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 7, Task 9
- **Description**:
  - Componente modal `<CommandPalette />` inspirado em shadcn/ui Command. Abre com `Ctrl+K` / `Cmd+K`, foca input imediatamente, fecha com ESC.
  - Backend: `GET /api/search?q=...&space=&tag=&author=&from=&to=` com paginação (20 resultados)
  - Query usa `ts_rank_cd(fts_vector, websearch_to_tsquery('simple', q))` combinado com semelhança de trgm no título (coalesce, 0 se < 3 caracteres)
  - Resultados mostram: título, breadcrumb do espaço/pai, snippet do conteúdo (termos destacados via `ts_headline`), autor, data de atualização
  - Caching leve: últimos 20 termos no servidor por 30s
- **Acceptance Criteria Addressed**: FR-6; AC-3
- **Test Requirements**:
  - `rule` TR-10.1: Abbreviated search test from AC-3: página "Backup do PostgreSQL" existe, query "backup postgres" retorna 1ª. Query "nginx restart" encontra página com bloco de código. Evidence: logs de API.
  - `rule` TR-10.2: Benchmark 100 req concorrentes (k6 ou autocannon): P95 response < 400ms, P99 < 800ms. Evidence: relatório do tool.
  - `rule` TR-10.3: Snippets no front contêm `<mark>` envolvendo termos buscados. Evidence: Playwright inspect DOM.

---

## Fase 3 — Histórico, Importador, Perfil, Permissões Completas e UX polimento

## Task 11: Histórico de Edições e Reversão
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 8
- **Description**:
  - Trigger no Postgres (ou listener no app após `PATCH pages`) que, ao salvar `content_markdown` publicado, INSERE em `page_versions` (page_id FK, version_number incrementado, snapshot markdown completo, author_id, created_at). Não duplicar se conteúdo é idêntico à versão anterior.
  - Rota `GET /api/pages/:id/versions` (lista paginada com autor e data). `GET /api/pages/:id/versions/:a/compare/:b` (retorna diff unified JSON formatado com lib `diff` npm).
  - Rota `POST /api/pages/:id/versions/:v/restore` (editor+): copia `snapshot` para `content_markdown` (gera nova versão com mesmo conteúdo), limpa rascunho.
  - UI: aba "Histórico" na página de edição. Listagem com cards. Botão "Comparar com versão atual" em cada linha. Tela de diff 2 colunas (ou inline, adições verdes, remoções vermelhas) com monaco/diff-view-react ou componente simples custom. Botão "Restaurar esta versão" com modal de confirmação.
- **Acceptance Criteria Addressed**: FR-7; AC-4
- **Test Requirements**:
  - `rule` TR-11.1: Criar v1 → editar → v2 → editar → v3 (diferentes autores). Histórico tem 3 versões. Comparar v1 vs v3 mostra pelo menos 1 diff de adição e 1 de remoção. Restaurar v2 cria v4 idêntica a v2 e v4 é a versão atualmente exibida. Evidence: assert IDs e conteúdo markdown nos bancos.
  - `rule` TR-11.2: Tentativa de salvar conteúdo idêntico à v3 não cria v4. Evidence: contagem não aumenta.

## Task 12: Importador de Legado HTML
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 7
- **Description**:
  - Script CLI em `apps/api/scripts/import-legacy-html.ts` executado via `pnpm --filter api import:legacy -- --dir ./legacy-html --space "Legado" --author admin@empresa.com`
  - Usa `turndown` com plugins (turndown-plugin-gfm para tabelas, strikethrough) para converter cada arquivo `.html` encontrado recursivamente em markdown
  - Estrutura de pastas reflete hierarquia: `legacy/Backup/postgres.html` torna-se página "Postgres" filha de "Backup" no espaço "Legado"
  - Preserva imagens se `<img src>` caminho relativo — copia arquivos para diretório attachments adequado e atualiza links no markdown
  - Gera relatório JSON `import-report-YYYYMMDD.json` com: total arquivos, sucessos, falhas (com motivo: parse error, conversão markdown com warnings, imagens quebradas)
  - Fase de dry-run primeiro: `--dry-run` exibe o plano sem escrever no banco
- **Acceptance Criteria Addressed**: FR-8; AC-6
- **Test Requirements**:
  - `rule` TR-12.1: Em pasta de teste com 10 arquivos HTML representativos (com tabelas, listas, code pre, imagens locais, links internos), dry-run retorna plano com 10 páginas. Run real cria 10 entradas em pages. 9/10 tem conteúdo markdown parseável sem erro. Evidence: relatório de importação.
  - `rubric` TR-12.2: Fidelidade visual em inspeção spot-check de 3 páginas; escala 1-5; 1=perdeu estrutura, 3=levemente diferente, 5=praticamente idêntica; threshold >= 4; Evidence: screenshots lado-a-lado HTML original vs página renderizada.

## Task 13: Tela de Perfil + Preferências (Tema, Senha) + Polimento Geral
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 6, Task 8
- **Description**:
  - Rota PATCH `/api/users/me` (altera nome, email). PATCH `/api/users/me/password` (exige senha atual + nova + confirmação)
  - Página `/settings/profile`: formulário atualizar dados, formulário trocar senha com força de senha (zxcvbn), toggle tema (sistema/claro/escuro) persistido em `users.theme_preference`
  - Página de ajuda acessada via `?` atalho: lista de todos atalhos de teclado implementados (Ctrl+K, Ctrl+N, Ctrl+S, Esc fecha modais, `?` ajuda)
  - Implementar atalhos restantes: `Ctrl+N` nova página (no espaço atual), `Ctrl+S` salvar publicação
  - Polimento: tooltips em botões, estados de loading com skeletons em listas, tratamento global de erro 404 e 500 (páginas bonitas), mensagens toast (sonner) em ações de sucesso/erro
- **Acceptance Criteria Addressed**: FR-9; NFR-7; AC-8
- **Test Requirements**:
  - `rule` TR-13.1: Trocar senha fraca (zxcvbn score < 2) retorna erro. Trocar senha forte + senha atual correta salva e novo login funciona. Evidence: testes API.
  - `rule` TR-13.2: Pressionar `?` abre modal ajuda; Ctrl+K abre busca; Ctrl+N abre editor vazio no espaço atual. Evidence: Playwright.
  - `rule` TR-13.3: Axe-core rodado em 5 telas (login, dashboard, página, editor, perfil) → 0 falhas de contraste ou aria. Evidence: relatório de acessibilidade.
  - `rule` TR-13.4: Matriz completa de permissões (6 cenários AC-1) testada via E2E. Evidence: suíte Playwright.

---

## Fase 4 — Testes, Documentação e Deploy Final

## Task 14: Testes Unitários e de Integração ≥ 70% cobertura serviços
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Tasks 4, 5, 7, 8, 10, 11
- **Description**:
  - Vitest para API. Testar serviços (não handlers): AuthService, PageService, SearchService, SpaceService, VersionService
  - Cobertura de casos de borda: ciclo em árvore de páginas, permissões faltantes, diff em versões idênticas, FTS com acentuação, buscas vazias
  - CI script opcional (GitHub Actions ou local): rodar typecheck + lint + tests + lint de migrations a cada commit
- **Acceptance Criteria Addressed**: NFR-4 (testes)
- **Test Requirements**:
  - `rule` TR-14.1: `pnpm test -- --coverage` mostra cobertura statements ≥ 70% em `apps/api/src/services`. Evidence: saída `coverage/lcov.info` ou terminal.
  - `rule` TR-14.2: Suíte inteira roda sem rede externa (tudo mocked ou usando testcontainer de Postgres — validar no CI). Evidence: resultado.

## Task 15: Documentação de API Swagger + docs de Operação
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 3, Task 4, Task 7, Task 10
- **Description**:
  - `@fastify/swagger` + `@fastify/swagger-ui` servindo em `/docs` com todas rotas documentadas (JSON Schema dos requests + responses + exemplos). Rotas autenticadas mostram header Cookie/JWT necessário.
  - `docs/op-guide.md`: (1) Procedimento de deploy passo a passo com screenshots de comandos. (2) Backup diário via script `backup.sh` (pg_dump + tar attachments) e retenção 30 dias. (3) Como atualizar versão: `git pull`, `podman-compose build --no-cache app`, `podman-compose up -d`, rodar migrations. (4) Troubleshooting comum (contêiner unhealthy onde verificar logs, reset senha admin via script CLI `reset-admin-password.ts`). (5) Checklist de go-live: definir JWT_SECRET longo, ajustar pg `shared_buffers = 1GB` se RAM ≥ 4GB, rodar importador de legado em ambiente de teste primeiro, validar certificado TLS.
  - Script CLI: `apps/api/scripts/reset-admin-password.ts --email admin@corp --password novaSenha123`
- **Acceptance Criteria Addressed**: NFR-2, NFR-4 (operacionalidade); AC-5
- **Test Requirements**:
  - `rule` TR-15.1: Acessar `/docs` lista pelo menos 20 endpoints e cada um tem request schema + 200 response schema. Evidence: screenshot ou curl `/docs/json`.
  - `rule` TR-15.2: Executar procedimento de backup descrito em docs → gerados (1) `backup-db-YYYYMMDD.sql` (pg_dump), (2) `backup-attachments-standard-YYYYMMDD.tar.gz` (volume wikicat-attachments tier standard), (3) `backup-attachments-large-YYYYMMDD.tar.gz` (volume wikicat-attachments-large tier large, arquivo separado). Apagar parcialmente os 3 volumes → restaurar a partir dos arquivos → dados recuperados em cada tier corretamente (sem cruzar paths). Evidence: teste manual de backup/restore + md5sum de antes/depois comparados em amostra de 5 arquivos standard e 3 arquivos large.

## Task 16: Auditoria Final de Conformidade SDD + Licenças FLOSS
- **Status**: `pending`
- **Priority**: high (gate de lançamento)
- **Depends On**: Tasks 1 a 15 (todas)
- **Description**:
  - **Auditoria de Rastreabilidade SDD**: Mapear 100% dos ACs de `spec.md` para suas tasks em `tasks.md` e vice-versa. Criar uma matriz markdown `docs/sdd-traceability-matrix.md` mostrando cada AC → tasks que o cobrem → status das tasks. Garantir que não há AC "órfão" sem implementação e que não há feature implementada sem AC correspondente.
  - **Auditoria de Licenças**: Rodar `license-checker` (MIT) ou `licensee` nas dependências npm do monorepo. Gerar relatório em `docs/license-report.txt` listando todas as dependências (produção) e suas licenças. **Falha se**: qualquer dependência de produção tiver licença proibida (GPL forte, licença comercial, license "UNKNOWN", proprietária). Ação corretiva: substituir dependência por equivalente FLOSS antes do go-live.
  - **Auditoria de Código vs. Spec**: Revisão spot-check manual de 10 features críticas (autenticação, CRUD espaços, CRUD páginas, editor 2 tiers de anexos, busca, histórico, deploy, backup separado de attachments-large) para garantir que o comportamento do código corresponde exatamente ao descrito em `spec.md`. Qualquer divergência → abrir issue em tasks.md para alinhar código ao spec (ou emendar o spec se a divergência foi aprovada em conversa).
  - **Auditoria específica de isolamento tiers de anexos (OQ-6)**: Verificar que (a) dois volumes Podman nomeados distintos, (b) dois mount paths separados no contêiner app, (c) schema attachment tem coluna `storage_tier NOT NULL CHECK (IN ('standard','large'))`, (d) backend valida `Content-Length` pré-streaming para rota large, (e) arquivo > 20MB recusado em rota standard, (f) nenhum arquivo de tier large caiu em /attachments por engano.
  - **Checklist de Pré-Lançamento**: Itemizar e marcar todos os checks em `docs/pre-launch-checklist.md`: JWT_SECRET com ≥ 32 chars, TLS no Caddy, backup automático agendado via cron (3 backups separados db/standard/large), 3 volumes montados corretamente, teste de restore executado para os 3 tiers, primeiro admin criado e senha temporária alterada, usuários iniciais provisionados, `MAX_ATTACHMENT_LARGE_MB` alinhado com espaço disponível no disco de attachments-large.
- **Acceptance Criteria Addressed**: Goals 7 (SDD) + 8 (Zero pagos); Constraints Technical (FLOSS + isolamento storage tiers) + Business (SDD rigoroso)
- **Test Requirements**:
  - `rule` TR-16.1: Matriz de rastreabilidade em `docs/sdd-traceability-matrix.md` lista todos os ACs de spec.md, cada um com ≥ 1 task vinculada, 0 ACs órfãos. Evidence: arquivo markdown com as linhas.
  - `rule` TR-16.2: Relatório de licenças de dependências de produção contém ZERO dependências com licença proibida (GPL-3.0, AGPL, Commercial, UNKNOWN). Todas são MIT/Apache-2.0/BSD/ISC/PostgreSQL/MPL-2.0. Evidence: arquivo `docs/license-report.txt` + grep com exit code 1 para licenças proibidas retorna 0 matches.
  - `rubric` TR-16.3: Qualidade da conformidade spot-check (10 features); escala 1-5; 1 = ≥ 4 divergências vs spec, 3 = 1-2 divergências menores sem impacto AC, 5 = 0 divergências e cada feature reproduz AC passando; threshold >= 4; Evidence: documento de evidência com screenshots/comandos para cada uma das 10 features.
  - `rule` TR-16.4: `docs/pre-launch-checklist.md` tem todos os itens marcados com evidência. Evidence: arquivo completo e aprovado.
  - `rule` TR-16.5: Auditoria de isolamento de anexos tiers. Insert 2 anexos via API (standard 2MB PNG, large 600MB dummy ISO). `SELECT id,storage_tier,storage_path FROM attachments` retorna standard path começando com `/attachments/` e large com `/attachments-large/`. Rodar `find /attachments -type f` no contêiner → só aparece PNG. `find /attachments-large -type f` → só aparece ISO. 0 cross-contamination. Evidence: SQL + find outputs.
