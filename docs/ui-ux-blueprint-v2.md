# WikiCat — Engineering documentation workspace

Specification-driven UI/UX blueprint · 13 September 2026

Delivery: system assessment, visual specification, React implementation examples, backend boundaries, and release criteria. Application code, stored content, dependencies, and deployment configuration are unchanged. Proposed features below are development requirements, not existing capabilities.

## 0. System assessment

### Architecture inspected before design

| Layer | Current source | Design consequence |
| --- | --- | --- |
| Workspace | pnpm monorepo: `apps/web`, `apps/api`, `packages/shared` | Preserve package boundaries and pnpm lockfile |
| Client | React 18, TypeScript, Vite 5, React Router 6, Tailwind 3, Zustand | Extend this stack; no framework migration |
| Primitives | Radix Dialog/Dropdown, CVA Button, Input, Card, Chip, Lucide | Retain Radix behavior; correct shared tokens, semantics and sizing |
| Authoring | TipTap 3 → HTML → Turndown → Markdown; raw source mode | Markdown remains canonical; rich editing must preserve supported syntax |
| Rendering | React Markdown, GFM, heading plugins, Lowlight | One AST must drive rendering, heading anchors and ToC |
| Transport | `apps/web/src/api/client.ts`: cookie-authenticated `/api` fetch, ApiError, optional AbortSignal | Reuse session and request conventions; normalize serialized dates for new DTOs |
| Server | Fastify 5: auth, spaces, pages, tags, attachments, health modules | Search, AI, relationship queries and version-history routes are absent |
| Persistence | Drizzle/PostgreSQL: users, spaces, hierarchical pages, tags, attachments, versions, auth tokens | Tree/tags/uploads exist; version table and search types do not establish working history/search |
| Search foundation | SQL maintains `fts_vector`; GIN/trigram indexes; shared search DTOs | Build PostgreSQL retrieval before semantic answers; add section indexing |
| Authorization | Cookie JWT, token revocation, current user, global admin/editor/viewer roles | No per-space membership model was found; do not promise private-space ACLs |
| Deployment | Container image, Caddy, compose manifests, separate attachment volumes | Retain intranet operation; fonts, assets and optional inference stay local |
| Product constraints | `.trae/specs/spec.md`, `.trae/specs/tasks.md` | Local accounts, FLOSS dependencies, direct publication, no approval workflow. This request raises the older AA target to AAA |

Review covered route surfaces, shared layout/primitives, editor and renderer, transport, theme/auth stores, API modules, schema/migrations, and deployment structure. This is a source assessment, not a live deployment or complete security audit. The directory is not a Git repository, so no Git diff baseline was available.

### Route and workflow map

| Existing route | Current behavior | Target |
| --- | --- | --- |
| `/login` | Local email/password and post-login redirect | Compact branded login; truthful account wording; keyboard password visibility and linked errors |
| `/` | Space listing/creation, local filter, static operational widgets | Search, actual page/space counts, real recent items when available |
| `/s/:slug` | Expanded tree plus flat list; native prompt creates page | Collapsible hierarchy, explicit title filter, creation dialog with parent selector |
| `/s/:slug/tags` | Tag directory; all-page data is not fetched | Label as tag directory; do not imply an empty all-pages result |
| `/s/:slug/tag/:tagName` | Tagged page list and local search | Shared shell, route-derived selected tag, robust encoded names |
| `/s/:slug/p/:id` | Separate shell; editors initially edit; preview/graph controls | Persistent navigation/search, reading first, explicit edit, real relationships |
| Unknown route | 404 recovery links | Preserve recovery; eliminate nested button/link markup |

Authoring today: fetch page/tree/attachments → edit title/Markdown → debounce 3 seconds → PATCH draft → explicit publish PATCH → reload. Tags save independently. Standard and large uploads have separate routes; download URLs identify attachments by ID.

### Findings that determine implementation order

| Priority | Source evidence | Required change |
| --- | --- | --- |
| P0 | `PageRenderer.CodeBlock` interpolates document text into `dangerouslySetInnerHTML`, including fallback | Render Lowlight AST/text through React; no unescaped HTML construction |
| P0 | `PageEditorPage.saveDraft` clears dirty after response; publish/autosave can overlap; effect does not return load cleanup | Serialize per-page writes, track local revision, ignore obsolete responses, preserve newer edits |
| P0 | `TipTapEditor.mdFallbackToHtml` parses a limited subset | Round-trip corpus; unsupported content stays source-editable; opening a document must not rewrite it |
| P1 | Navbar owns palette, but document/tag routes omit AppShell | One persistent authenticated workspace shell and palette host |
| P1 | Palette searches only spaces, intercepts Tab for AI, advertises unimplemented arrows | Honest search scope, real keyboard selection, ordinary Tab navigation |
| P1 | Sidebar child groups/tools are decorative; mobile sidebar disappears | Real disclosure controls using page-tree data; same navigation in mobile drawer |
| P1 | ToC uses a different slug regex, includes fenced headings, displays fixed 38% | Shared AST anchors, accurate progress from actual scroll container |
| P1 | Mermaid regex limits six edges and loses topology; graph has no node interaction | Real Mermaid or explicit source fallback; evidence-backed relationship graph |
| P1 | Dashboard health, owners, review queue, activity and sync data are static | Missing data is unavailable, never fabricated healthy/zero/percentage |
| P1 | API health replies are constant `ok`; graph labels last updater as owner | Measure health before displaying it; add accountable owner separately |
| P1 | Hardcoded dark chrome, tiny metadata, low contrast, removed focus outlines, undersized controls | Semantic theme tokens, 14px metadata, 44px targets and tested focus |
| P2 | HTML language is `en` while UI is Portuguese; login implies network identity | `lang=pt-BR`; local-account copy unless SSO exists |
| P2 | No typography/animation Tailwind plugin despite plugin-like classes | Explicit prose/motion CSS; no reliance on missing utilities |

`SpaceSummary.pageCount` is not a published-only metric: label it “Páginas”. Do not infer environment, document type, owner, or system health from tags, last updater or a green icon. Existing data already supports names, page totals, hierarchy, authors, timestamps, tags and attachment counts.

## 1. Design system and visual language

### Direction

Build a precise engineering workbench: neutral chrome, solid reading surfaces, emerald route/action emphasis, indigo relationships, violet architecture notes. Paths, code and provenance provide identity. Reserve a subtle 24px grid for graphs. Glass is limited to header overlays with a solid backing; prose is opaque. Replace moving gradient buttons and persistent healthy pulses with crisp borders and explicit state labels.

UI copy stays Portuguese: “Buscar documentação”, “Nesta página”, “Alterações não salvas”, “Rascunho salvo às 14:32”, “Publicar”, “Sem relações documentadas”. Technical identifiers use monospace. Define acronyms in prose/glossaries without altering command text.

### Color tokens

Opaque sRGB values below are designed for ≥7:1 normal-text contrast across canvas/surface/raised. Decorative separators need not identify controls; interactive boundaries use the separate control token. Never apply arbitrary user-selected tag colors to text; use a decorative swatch and neutral label.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `canvas` | `#f8fafc` | `#090d14` | Workspace |
| `surface` | `#ffffff` | `#101722` | Reader, dialog, panels |
| `raised` | `#f1f5f9` | `#182231` | Hover/selected background |
| `text` | `#0f172a` | `#f8fafc` | Body, headings, labels |
| `muted-text` | `#334155` | `#cbd5e1` | Metadata, placeholders, code comments |
| `line` | `#cbd5e1` | `#334155` | Decorative separator |
| `control-border` | `#64748b` | `#94a3b8` | Input boundary, meaningful graph edge |
| `emerald` | `#065f46` | `#6ee7b7` | Active route, link, verified success |
| `indigo` | `#3730a3` | `#c7d2fe` | Relationships, functions |
| `violet` | `#5b21b6` | `#ddd6fe` | Architecture, syntax keywords |
| `warning` | `#78350f` | `#fde68a` | Caution text/icon |
| `danger` | `#991b1b` | `#fecaca` | Errors, removed-line markers |
| `action-bg` | `#065f46` | `#6ee7b7` | Solid primary action |
| `action-text` | `#ffffff` | `#090d14` | Primary action label |
| `focus` | `#3730a3` | `#c7d2fe` | 3px focus outline |

Introduce `--wk-*` variables under `.workspace-v2`, with dark overrides under `.dark .workspace-v2`. Map them to Tailwind `workspace.*` colors as `var(--wk-surface)` etc. Keep existing HSL variables during rollout: replacing an HSL tuple with hex would break current `hsl(var(--primary))` consumers. Apply token scope to portaled modal content as well as the shell. Test actual hover/composited states, not just the token table.

### Typography and layout tokens

| Role | Size / line-height / weight | Use |
| --- | --- | --- |
| Document H1 | `clamp(1.75rem,2.5vw,2.5rem)` / 1.2 / 650 | Wrap naturally; actual heading in read mode |
| H2 | 1.5rem / 1.35 / 650 | 40px preceding space, 16px after |
| H3 | 1.125rem / 1.5 / 600 | 32px before, 12px after |
| Body | 1rem / 1.75 / 400 | Default 68ch; adjustable 60–72ch; ragged right |
| Navigation/control | .875rem / 1.5 / 500 | 44px minimum target |
| Metadata | .875rem / 1.5 / 400 | No essential 9–11px labels |
| Code | .875rem / 1.7 / 400 | Exact whitespace, optional wrap, bounded scrolling |

Sans: `Inter, ui-sans-serif, system-ui, "Segoe UI", sans-serif`. Mono: `"JetBrains Mono", ui-monospace, Consolas, monospace`. Bundle licensed WOFF2 locally or use system fallbacks; Tailwind font declarations alone do not install fonts.

Spacing: `4,8,12,16,20,24,32,40,48,64px`, expressed in rem. Controls use 12–16px horizontal padding. Panels use 24px; reader uses 32px desktop/16px mobile. Radius: 4px inline code, 6px badge, 8px control, 12px panel, 16px palette. Focus: 3px outline, 3px neutral offset, no clipping.

Micro-shadows: surface `0 1px 2px rgb(0 0 0 / .06)`; popover `0 8px 24px -8px rgb(0 0 0 / .20)`; modal `0 24px 64px -16px rgb(0 0 0 / .45)`. Use borders for structural definition. No glow is needed to recognize an action.

### Component library

| Component | Anatomy/contract | Interaction |
| --- | --- | --- |
| Command palette | Named dialog, labeled combobox, scope, results, optional sourced answer; controlled query/request state | Cmd/Ctrl+K; arrows select; Enter opens; Escape closes; Tab traverses actual controls |
| Code block | Caption with language/path, Copy and Wrap, `<pre><code>`; raw source string | React AST highlights; unknown language is plain; exact source copy; announce copy failure/success; named keyboard-scrollable region |
| Diff block | Revision selectors, summary, unified lines, old/new numbers | `+`/`−` and accessible added/removed labels; copy-current excludes markers/deletions; unified view on narrow screens |
| Callout card | Native details/summary, type, actionable title, body | Explicit `[!WARNING]`, `[!TIP]`, `[!NOTE]` markers; warning starts open; summary retains warning when collapsed; other blockquotes stay quotations |
| Floating ToC | Heading links, current marker, progress | Shared AST IDs; `aria-current=location`; mobile disclosure; wrap long labels; activation expands containing callouts and focuses heading |
| Process node | Type, title, relationship count, evidence link | Selected outline + text; Enter opens inspector; equivalent list exposes every edge; focus never navigates |
| Internal-link preview | Title, path, timestamp, ≤240-character excerpt | 300ms hover/focus intent; Escape dismisses; hoverable and persistent; explicit touch preview button; link still navigates normally |
| Save indicator | Dirty/saving/saved/error/conflict union | Polite transition announcement, retry, retained buffer, no simulated percentages |

Previews cancel obsolete fetches, deduplicate by session/page ID, invalidate on update/logout and never retain restricted snippets after authorization changes.

## 2. Core layout and component architecture

### Desktop blueprint

At 1440px: 272px nav, 1168px work area. Work area has 32px outer gutters, 24px gap, 240px ToC and 840px reader column. Prose is centered at 68ch inside the reader. Header is at least 64px and grows with zoom; document tools wrap into a second row.

```text
┌──────────────────────┬──────────────────────────────────────────────────┐
│ WikiCat / workspace  │ Search [Ctrl K]                    Theme Account │
├──────────────────────┼──────────────────────────────────────────────────┤
│ ▾ Plataforma         │ Plataforma / Deploy / Rollback                  │
│   ▾ Deploy           │ Rollback do serviço de pagamentos               │
│     Rollback ◀       │ Author · timestamp · actual tags                │
│     Validação        │ [Ler] [Relações]                      [Editar]   │
│   ▸ Arquitetura      ├─────────────────────────────────┬────────────────┤
│ ▸ IT Ops             │ Prerequisites                   │ Nesta página   │
│                      │ [Warning: verify environment]   │ Prerequisites  │
│                      │ Procedure                       │ Procedure ◀    │
│                      │ ┌ bash ───────── Copy · Wrap ┐  │ Validation     │
│                      │ │ exact command source       │  │ Rollback       │
│                      │ └────────────────────────────┘  │                │
│                      │ Validation / rollback           │ Progress       │
└──────────────────────┴─────────────────────────────────┴────────────────┘
```

The example title is illustrative, not seeded operational data. ≥1280px: three regions. 1024–1279px: 248px nav, ToC disclosure above content. Below 1024px: navigation drawer with persistent 44px menu trigger, inline ToC. At 320px CSS width actions stack and modal fits 16px gutters. Never remove essential actions. Tables/code/graphs may scroll inside named regions; prose must reflow without page-wide horizontal scrolling.

Use one main work-area scroll container (`min-height:0; overflow-y:auto`) and independently scrolling nav. Supply the main scroll ref to observers; do not use window scroll for this shell. Derive sticky/anchor offsets from measured header height; leave focus clearance at both ends. Avoid fixed header height when content wraps.

### Ownership tree

```text
ProtectedRoute
└── WorkspaceLayout                 persistent shell + route Outlet
    ├── SkipLink → #workspace-main
    ├── WorkspaceNavigation         spaces + active-space page tree
    │   └── PageBranch              nested list / disclosure / Link
    ├── WorkspaceHeader             search, theme menu, account/logout
    ├── CommandPaletteHost          one global shortcut subscription
    └── MainScrollRegion
        ├── Dashboard / Space / Tags
        └── DocumentWorkspace       route data + buffer + save coordinator
            ├── Breadcrumbs / Header / ModeToolbar
            ├── DocumentReader     Markdown, attachments, ToC
            │   ├── CodeBlock / Callout / InternalLinkPreview
            │   └── DiagramBoundary
            ├── DocumentRelations  graph + equivalent list
            └── DocumentEditor     preserved TipTap/source session
```

Preserve all pathnames. Use `?view=read|relations|edit` for bookmarkable mode; default read. Viewer edit URLs resolve to read with a message; backend retains write enforcement. Reading and relations are available to viewers. Document/tag routes use the shell without duplicating `<main>` or headers.

Keep route data and draft state in DocumentWorkspace; ephemeral UI local; existing Zustand handles identity/theme. Persist expansion by user/space/page ID and clear scoped caches on logout. Automatically expand active ancestors on deep links. Collapsing a branch containing focus returns focus to its disclosure.

Use nested `ul` lists with separate page links and 44px disclosure buttons carrying `aria-expanded`/`aria-controls`. Tab visits visible controls; Enter follows links; Space toggles disclosure. Do not apply `role=tree` without its complete arrow-key model. Support arbitrary stored depth, cap indentation at five levels, and reveal deeper hierarchy through full breadcrumbs. Current API returns the whole tree; pagination/virtualization requires explicit follow-up design, not invented lazy child routes.

### State triggers

| Trigger | Result |
| --- | --- |
| Hover control/nav | Raised surface + border/underline emphasis; no layout shift |
| Keyboard focus | Visible 3px outline; focused target wholly clear of sticky chrome |
| Active page | Left rail + `aria-current=page`; never color alone |
| Open edit | Initialize buffer once; lazy-load editor; separate published and draft content |
| Toggle modes while dirty | Preserve buffer/undo; label preview “Prévia do rascunho”; do not write merely because mode changed |
| Focus editing mode | Hide nav/ToC, keep save and “Sair do modo foco”; restore focus/scroll on exit |
| Search | 180ms debounce → loading → results/empty/error; abort old request and latest request wins |
| Fetch failure | Specific 401/403/404/network response; retry retains route and buffer |
| Clipboard denied | Visible failure + polite announcement; source remains selectable |
| Upload | Actual byte progress or indeterminate indicator; AbortController cancellation; completion only after server response |
| Link preview | Hover/focus intent opens; Escape closes without blurring link |

Cmd/Ctrl+K works throughout the workspace, ignores repeats/IME composition. Cmd/Ctrl+S operates only in authorized edit mode. Do not steal Ctrl+N, browser zoom, native text editing keys or Tab. Shortcut help is a reachable labeled button; allow disabling/remapping custom shortcuts.

### Data preservation rules

Each save captures `{pageId, localRevision, title, markdown}`. Clear dirty only when the acknowledgment matches the latest local revision; queue the newest buffer rather than concurrent PATCHes. Responses for a previous route never alter current page state. Publishing drains debounce, waits for current save, and publishes a captured revision; newer edits remain dirty. Failed prerequisites stop publish and keep the buffer.

Add server revision/ETag and atomic 409/412 conflict handling separately; show local/server comparison before explicit overwrite. Preserve edits through internal navigation and reauthentication. Current `isDraft` affects reader selection too: establish published/draft API semantics before promising private drafts or changing viewer behavior. Direct publication remains available to editor/admin without an approval workflow.

New-page dialog collects title/parent, validates API rules and calls existing creation. Optional runbook/SOP/architecture templates insert editable Markdown only. Ingestion previews source/rendering before saving; unsupported constructs remain in source mode. Retain standard/large attachment routes and download IDs. Verify multipart overhead and configured limits; do not rely on manually setting browser `Content-Length` to raw file size.

## 3. Front-end implementation code specifications

These are React/TypeScript implementation references, not a complete integrated replacement. They use the current stack. Wire them after P0 rendering/save fixes. Token scope must include portals; Tailwind arbitrary-value utilities avoid a version upgrade.

### Reader container and callout

`children` is an already-safe render tree. Integrate the corrected Markdown pipeline here, not the current unsafe HTML code path. The route owns the single main landmark. Reader title is H1; editing uses a separately labeled title input. ToC is placed before article in DOM for mobile and positioned to the right on desktop.

```tsx
import { useId, type ReactNode } from 'react';

export function TechnicalCallout({ kind, title, children }: {
  kind: 'warning' | 'tip' | 'architecture'; title: string; children: ReactNode;
}) {
  const label = { warning: 'Atenção', tip: 'Dica', architecture: 'Arquitetura' }[kind];
  const border = {
    warning: 'border-l-[var(--wk-warning)]', tip: 'border-l-[var(--wk-emerald)]',
    architecture: 'border-l-[var(--wk-violet)]',
  }[kind];
  return (
    <details open className={`my-6 rounded-xl border border-[var(--wk-control-border)]
      border-l-4 bg-[var(--wk-surface)] text-[var(--wk-text)] ${border}`}>
      <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold">
        {label}: {title}
      </summary>
      <div className="border-t border-[var(--wk-line)] px-4 py-4 leading-7">{children}</div>
    </details>
  );
}

export function DocumentReader({ title, metadata, children, toc }: {
  title: string; metadata: ReactNode; children: ReactNode; toc: ReactNode;
}) {
  const titleId = useId();
  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_15rem]">
      <aside aria-label="Contexto do documento" className="min-w-0 xl:col-start-2 xl:row-start-1">
        <div className="xl:sticky xl:top-6">{toc}</div>
      </aside>
      <article aria-labelledby={titleId} className="min-w-0 rounded-xl border
        border-[var(--wk-line)] bg-[var(--wk-surface)] p-4 text-[var(--wk-text)]
        sm:p-8 xl:col-start-1 xl:row-start-1">
        <header className="mx-auto mb-10 max-w-[68ch]">
          <h1 id={titleId} className="text-[clamp(1.75rem,2.5vw,2.5rem)] font-semibold
            leading-tight tracking-tight [overflow-wrap:anywhere]">{title}</h1>
          <div className="mt-4 text-sm leading-6 text-[var(--wk-muted-text)]">{metadata}</div>
        </header>
        <div className="doc-prose mx-auto max-w-[var(--wk-reading-width,68ch)]">{children}</div>
      </article>
    </div>
  );
}
```

ToC uses a native disclosure on narrow screens, persistent navigation on desktop, and a single set of anchor IDs. Use a shared breakpoint hook or CSS treatment that preserves keyboard access; do not render duplicated hidden heading IDs.

### Command palette with keyboard selection

The persistent host owns query, cancellation and results. Today items can be filtered spaces with a truthful scope label; page/heading results need the proposed search API. `onChoose` constructs encoded internal routes from structured fields and closes the dialog. Never navigate to arbitrary AI-generated URLs. Reset query/results on opening. Store the prior focused element and return focus on close, falling back to the search button; navigation instead focuses the destination heading after load.

```tsx
import { useEffect, useId, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

export type CommandItem = {
  id: string; title: string; detail: string;
  spaceSlug: string; pageId?: string; anchor?: string;
};
type Props = {
  open: boolean; onOpenChange: (open: boolean) => void;
  query: string; onQueryChange: (query: string) => void;
  items: CommandItem[]; state: 'idle' | 'loading' | 'ready' | 'error';
  onRetry: () => void; onChoose: (item: CommandItem) => void; returnFocus: () => void;
};

export function SearchPalette(p: Props) {
  return <Dialog.Root open={p.open} onOpenChange={p.onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
      <Dialog.Content onCloseAutoFocus={e => { e.preventDefault(); p.returnFocus(); }}
        className="workspace-v2 wk-palette fixed left-1/2 top-[8dvh] z-50
          w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 overflow-y-auto rounded-2xl
          border border-[var(--wk-control-border)] bg-[var(--wk-surface)] p-4
          text-[var(--wk-text)] max-h-[84dvh]">
        <Dialog.Title className="text-lg font-semibold">Buscar documentação</Dialog.Title>
        <Dialog.Description className="mt-1 text-sm text-[var(--wk-muted-text)]">
          Use as setas para selecionar e Enter para abrir.
        </Dialog.Description>
        <PaletteBody {...p} />
        <Dialog.Close className="mt-3 min-h-11 rounded-lg border
          border-[var(--wk-control-border)] px-4">Fechar</Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

function PaletteBody(p: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [selected, setSelected] = useState(0);
  const results = p.state === 'ready' || p.state === 'idle' ? p.items : [];
  const active = Math.min(selected, Math.max(0, results.length - 1));
  useEffect(() => { setSelected(0); }, [p.query, p.items]);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    list.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active, results.length]);
  return <>
    <label htmlFor={`${id}-input`} className="mt-4 block text-sm">Termo de busca</label>
    <input ref={input} id={`${id}-input`} role="combobox" value={p.query}
      aria-autocomplete="list" aria-expanded={true} aria-controls={`${id}-list`}
      aria-activedescendant={results[active] ? `${id}-option-${active}` : undefined}
      onChange={e => p.onQueryChange(e.target.value)}
      onKeyDown={e => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          if (results.length) setSelected((active + (e.key === 'ArrowDown' ? 1 : -1)
            + results.length) % results.length);
        }
        if (e.key === 'Enter' && results[active]) {
          e.preventDefault(); p.onChoose(results[active]);
        }
      }}
      className="mt-2 min-h-11 w-full rounded-lg border border-[var(--wk-control-border)]
        bg-[var(--wk-surface)] px-3 text-base" />
    <p role="status" className="my-3 text-sm text-[var(--wk-muted-text)]">
      {p.state === 'loading' ? 'Buscando…' : p.state === 'error'
        ? 'A busca falhou. Tente novamente.' : `${results.length} resultados`}
    </p>
    {p.state === 'error' && <button type="button" onClick={p.onRetry}
      className="min-h-11 rounded-lg border border-[var(--wk-control-border)] px-3">
      Tentar novamente</button>}
    <ul ref={list} id={`${id}-list`} role="listbox" aria-label="Resultados da busca"
      aria-busy={p.state === 'loading'} className="max-h-[40dvh] overflow-y-auto">
      {results.map((item, index) => <li key={item.id} id={`${id}-option-${index}`}
        role="option" aria-selected={index === active}
        onPointerMove={() => setSelected(index)} onMouseDown={e => e.preventDefault()}
        onClick={() => p.onChoose(item)}
        className={`min-h-11 cursor-pointer rounded-lg border-l-4 px-3 py-3
          ${index === active ? 'border-[var(--wk-emerald)] bg-[var(--wk-raised)]'
            : 'border-transparent'}`}>
        <span className="block font-medium">{item.title}</span>
        <span className="block text-sm text-[var(--wk-muted-text)]">{item.detail}</span>
      </li>)}
    </ul>
    {p.state === 'ready' && !results.length &&
      <p className="py-4 text-sm">Nenhum resultado. Tente outro termo ou espaço.</p>}
  </>;
}
```

The input keeps DOM focus and `aria-activedescendant` tracks the active option, consistent with the [WAI-ARIA combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/). Tab remains unhandled so Retry and Close are reachable. Radix supplies modal containment/Escape; explicit return-focus handling covers shortcut activation without a Dialog.Trigger.

### Rendering, code, diagrams and deep links

Generate Markdown rendering, ToC and section search from the same AST. Exclude fenced headings, preserve Unicode, deduplicate repeated slugs. Prefix new IDs with `doc-`; retain aliases for existing public anchors. Future stable section IDs must survive heading renames through an index contract, not a text-only slug claim.

Override React Markdown `pre` to handle block code; regular `code` handles inline. Do not depend on an untyped `inline` prop. Use Lowlight's language/value signature and render text leaves as strings and element leaves as React spans with allowed `hljs-*` classes. Never use `dangerouslySetInnerHTML` for code. Copy uses the original source, independent of visual wrapping. Syntax colors: strings→emerald, keywords→violet, functions→indigo, numbers→warning, comments→muted-text. Unknown languages stay plain text.

Add actual Mermaid only after license/lockfile review. Lazy-load for visible diagrams; use unique render IDs, `startOnLoad:false`, `securityLevel:'strict'`, `htmlLabels:false`, and sanitized SVG insertion. Strict mode disables diagram click functionality; implement navigation/inspection through separate React controls. See [Mermaid security configuration](https://mermaid.js.org/config/schema-docs/config.html#securitylevel). Do not weaken security to enable embedded callbacks.

DiagramBoundary handles parse errors, stale async completion and oversized input. Proposed limits: 50KB source, 200 nodes, 400 edges; larger diagrams use a dedicated viewer/source fallback. Use a worker-backed parse/layout budget where supported; a Promise timeout cannot stop synchronous CPU work. Always expose source, text explanation, and structured relationship list. A Mermaid flowchart is not automatically a service dependency graph.

Callouts are detected by explicit first-paragraph AST marker. Ordinary quotations retain blockquote semantics. On section activation, expand containing details before scrolling and focusing a `tabIndex=-1` heading. Images need meaningful alt text; diagrams need an equivalent explanation. Keep raw HTML and executable URL protocols disabled in reader, previews and AI responses.

ToC observes actual rendered headings against the main scroll ref. Choose the last heading above a 96px reading line, or first heading initially. In scroll-container coordinates, let `A` be article top, `H` article height, `V` usable viewport height below sticky chrome, and `S` current scroll position plus sticky offset. Progress is `100 * clamp((S - A) / (H - V), 0, 1)`; if `H <= V`, show 100% when the article is fully visible. Recompute on images, resize, font changes and disclosure expansion using ResizeObserver and requestAnimationFrame. Progress has accessible name/value but is not a continuously announcing live region.

### Motion and prose CSS

```css
.workspace-v2 { color: var(--wk-text); background: var(--wk-canvas); --wk-reading-width: 68ch; }
.workspace-v2:focus-visible, .workspace-v2 :focus-visible {
  outline: 3px solid var(--wk-focus); outline-offset: 3px;
}
.doc-prose { font-size: 1rem; line-height: 1.75; overflow-wrap: anywhere; }
.doc-prose p { margin-block: 0 1.75em; }
.doc-prose :is(h2,h3,h4,h5,h6) { scroll-margin-block-start: var(--wk-scroll-offset,6rem); }
.doc-prose pre { overflow: auto; overflow-wrap: normal; white-space: pre; }
.doc-prose a { text-decoration: underline; text-underline-offset: .2em; }
.wk-interactive { transition: background-color 140ms ease, border-color 140ms ease; }
.wk-palette[data-state="open"] { animation: wk-enter 160ms cubic-bezier(.2,.8,.2,1); }
@keyframes wk-enter { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .workspace-v2 *, .workspace-v2 *::before, .workspace-v2 *::after,
  .workspace-v2.wk-palette {
    animation: none !important; transition: none !important; scroll-behavior: auto !important;
  }
}
@media (forced-colors: active) {
  .workspace-v2:focus-visible, .workspace-v2 :focus-visible { outline-color: Highlight; }
  .workspace-v2 [aria-selected="true"] { border-color: Highlight; }
}
```

Dialog fade does not change positioning transforms. Expand disclosures immediately, optionally rotate decorative chevron for 120ms. Reading progress has no delayed easing. Stop skeleton animation after 5 seconds and show static loading text. No permanent operational pulse. CSS is sufficient; no Framer Motion dependency is necessary.

### Proposed additive backend contracts

| Endpoint/extension | Minimum response/behavior | Prerequisite |
| --- | --- | --- |
| `GET /api/search?q=&spaceSlug=&cursor=` | `query,total,tookMs,nextCursor`; results with page ID, space slug, title, breadcrumb, plain snippet, section ID/anchor, ISO timestamp | Existing FTS query plus section index; exact identifiers/title rank above body |
| `POST /api/search/answer` | Request query/scope; response answer, sources `{pageId,sectionId,anchor,revision,quote}`, generatedAt | Authorized retrieval, local model capacity, capability flag |
| `GET /api/pages/:id/relations?direction=&cursor=` | Typed nodes/edges, evidence section/revision, truncation/pagination | Published-link extraction plus explicit dependency metadata |
| `GET /api/pages/:id/versions` and `/diff?from=&to=` | Existing version/diff concepts, immutable IDs and ISO dates | Transactional snapshot writes; current update service does not write versions |
| `POST /api/pages/:id/restore` | versionId + expectedRevision → new revision | Atomic conflict check and role enforcement |
| Metadata extension | Validated docType/environment/ownerUserId/reviewDueAt | Schema/DTO and actual editor controls; existing JSON metadata is not an exposed contract |

These routes do not exist today. Extend shared DTOs and API modules; do not hide unavailable features behind fake responses. Authorization predicates must match direct reads for search, previews, answers and relationships. Current access is authenticated/global; private-space membership requires a real server model first. Exclude deleted content; explicitly decide published/draft indexing before retrieval. Client-provided permission strings are not authorization. Cache per session and invalidate on access changes/logout.

AI interaction is an explicit “Resumir resultados” button, visible only with capability and retrieved results. Display 2–4 concise sentences above normal results, with resolvable source citations and “Abrir seção”. States: retrieving, generating, ready, insufficient evidence, unavailable. Proposed 10-second timeout preserves ordinary results and offers retry. Source documents are untrusted data, never instructions to the model; answers invoke no operational tools. No generic chat panel, simulated answer or fake index timestamp.

## 4. UX innovation highlights

### 1. Runbook checkpoints

Problem: incident responders lose their place when moving between prerequisites, commands, verification and rollback. “Iniciar acompanhamento” opens a 240px checkpoint panel built from explicitly authored runbook steps. Selecting jumps to the section; checking records completion without editing the document or executing a command.

Session shape: `{pageId,publishedRevision,completedStepIds,activeStepId,startedAt}` in per-user sessionStorage, cleared on logout. Revision change invalidates prior completion and offers comparison. Gate this feature until stable revision/step IDs exist. Native checkboxes and a text list provide full keyboard access. Never infer execution success or system health from a checked box.

Acceptance: reload resumes the same revision; a changed procedure never silently inherits completion. Runbook Markdown remains independently readable and publishable.

### 2. Section provenance

Problem: a page-level updated timestamp does not explain a changed command flag. Add “Histórico desta seção” to heading actions, reachable on hover, keyboard focus and touch. Inspector shows actual author, revision/time, note and unified section diff.

Use immutable page snapshots and section matching; never attribute all lines to the last updater. Renamed/unmatched sections fall back to full-page diff. Readers can compare; editors/admins can explicitly restore, producing a new revision. Copy-current excludes deleted lines and diff markers.

Acceptance: adding a flag identifies its exact changed line and snapshot author. Missing legacy history displays “Histórico indisponível para esta versão”. Requires version writes and conflict handling, not only the existing version table.

### 3. Dependency impact with source evidence

Problem: a hyperlink to Redis documentation does not prove an operational dependency. Distinguish `contains`, `links-to`, and explicitly authored `depends-on`. Each dependency exposes a source section/revision. Inferred candidates remain separate until confirmed by an editor.

Select a node to inspect incoming/outgoing relations and open evidence. Filter one/two hops, retain cycles, cap 200 nodes with visible truncation and pageable equivalent list. Show unknown ownership honestly. System health requires monitoring data plus freshness; document membership and runtime dependency remain distinct.

Acceptance: deleting a hyperlink removes its indexed link edge but not an independently authored dependency. Keyboard list and graph expose identical evidence. Stale evidence names its revision instead of implying current verification.

## 5. Accessibility, acceptance criteria and rollout

AAA is the target for the complete implemented experience, not a guarantee from tokens or an automated score. Validate all applicable A/AA/AAA criteria over full pages and complete workflows, including authored content. Normative reference: [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

Project gates: ≥7:1 normal text, ≥4.5:1 large text, ≥3:1 meaningful controls/graphics; 44×44 CSS-pixel controls; visible unobscured focus; keyboard operation; 320px reflow/400% zoom; text-spacing overrides; reduced motion; no hover-only information. Reading preferences provide width, text size, foreground/background and spacing selection. Supply diagram text equivalents, glossary/expanded acronyms and summaries for complex procedures. Preserve work through reauthentication, support password managers/paste, and make data changes reversible or reviewable.

These gates are not the full AAA checklist. QA must record criterion-by-criterion applicability and evidence for content, media, authentication, timeout, help and error prevention. Do not claim conformance until the complete audit passes.

### SDD implementation packages

Before implementation, add these requirement IDs and rule/rubric ACs to `.trae/specs/spec.md` and tasks/TRs to `.trae/specs/tasks.md`. This deliverable does not mark implementation tasks completed.

| Task | Priority / dependencies | Acceptance criteria and test requirements |
| --- | --- | --- |
| UI-01 Rendering integrity | P0 / none | Rule: HTML-like code, inline/fenced code, unknown languages, repeated/accented headings, nested quotes render safely; exact Copy; valid pre/code markup |
| UI-02 Authoring preservation | P0 / none | Rule: table/task/link/fence corpus round-trips or remains source-preserved; delayed/failed/out-of-order saves never lose edits; failed publish retains buffer |
| UI-03 Tokens/primitives | P1 / UI-01 | Rule: text contrast ≥7:1; boundaries/focus/targets pass both themes, forced colors, reduced motion |
| UI-04 Shared shell | P1 / UI-02,03 | Rule: all authenticated routes retain navigation/search; deep links and collapsible hierarchy keyboard work; drawer restores focus |
| UI-05 Reader | P1 / UI-01,03,04 | Rule: H1, ToC, progress, callouts, previews and attachments work on mobile/desktop without buffer loss |
| UI-06 Retrieval | P1 / UI-04 + search API | Rule: latest query wins; empty/error distinct; exact heading navigation; no restricted/deleted snippets; existing benchmark P95 ≤400ms with 500 pages/100 requests |
| UI-07 Versions | P1 / UI-02 + snapshot API | Rule: exact diff/restore, immutable new revision, accurate author, simultaneous edit conflicts |
| UI-08 Diagram/relations | P2 / UI-01 + relation API | Rule: branches/cycles retain topology; invalid/oversized source fallback; list parity and keyboard evidence navigation |
| UI-09 Contextual answer | P2 / UI-06 + local model | Rule: every source resolves to retrieved authorized revision; insufficient evidence abstains; timeout retains results; capability-off hides mode |
| UI-10 Release | P1 / all enabled tasks | Rule: complete role/workflow regression and AAA audit; rubric: 3 technical users find/copy/edit/restore with median ease ≥4/5 and no critical failure |

Regression matrix: viewer/editor/admin × login/deep links/space creation/page creation/draft/publish/tags/standard upload/large upload/cancel/download. Exercise browser Back/Forward while dirty, pending route requests, long Portuguese titles, 10-level trees, repeated Unicode headings, code containing HTML, invalid diagrams, empty spaces, expired session, 403/404/network errors, clipboard denial, and theme changes inside dialogs. Test configured upload boundaries against the real server and verify tier separation.

Use manual NVDA with Firefox/Chromium alongside axe and browser automation. Target ≤100ms feedback for palette selection/simple UI actions on a representative IT laptop. Keep lazy editor and diagram bundles out of the reader critical path. Performance budgets are proposed gates, not current measurements.

Rollout: P0 fixes → scoped primitives → shared shell → reader → retrieval → gated innovations. Add backend contracts compatibly; deploy workspace presentation behind a flag so old presentation can be restored without discarding content. Token changes need no database migration. Versions, stable sections, conflict detection and relationship metadata require separate migrations/backfill plans. Direct publication and separate attachment tiers remain invariant.

### Verification record

- Existing frontend typecheck passed: `node node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit`; approved sandbox escalation was needed to access installed packages.
- `node docs/verify-blueprint.cjs` checks documented contrast pairs, required sections and code fences; optional `--syntax` transpiles the two TSX examples.
- Verification passed: 56 contrast pairings; minimum normal-text contrast across neutral surfaces is 7.01:1 light and 10.50:1 dark. Both TSX examples passed syntax transpilation using the installed compiler with approved escalation.
- Application files were not changed. Snippet syntax checks are not integrated component tests.
- Live browser, database, screen-reader and full AAA checks were not performed; those are release gates above.
