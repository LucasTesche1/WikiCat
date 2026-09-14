# WikiCat UI/UX blueprint

> Historical design draft. The source-audited specification is now [UI/UX blueprint v2](ui-ux-blueprint-v2.md). Implementation and accessibility claims below describe earlier intent, not verified production capabilities.

## 1. Design system and visual language

### Visual thesis

WikiCat is an engineering operations surface, not a generic company portal. The interface uses a dark, gridded workspace, quiet glass surfaces, terse operational copy, and emerald/indigo accents that communicate state and hierarchy. Decorative imagery is intentionally absent; topology, code, metadata, and system state provide the visual identity.

### Tokens

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| Canvas | `hsl(216 33% 97%)` | `hsl(222 47% 5%)` | App background |
| Surface | `hsl(0 0% 100%)` | `hsl(220 39% 8%)` | Cards, dialogs, reader |
| Text | `hsl(222 47% 8%)` | `hsl(214 32% 93%)` | Primary content |
| Muted text | `hsl(218 18% 34%)` | `hsl(215 17% 67%)` | Metadata |
| Border | `hsl(216 23% 84%)` | `hsl(217 27% 17%)` | Surface definition |
| Terminal emerald | `hsl(158 72% 27%)` | `hsl(158 64% 52%)` | Healthy, active, primary |
| System indigo | `hsl(231 74% 55%)` | `hsl(231 89% 70%)` | Graphs, relationships |
| Neon violet | `hsl(263 70% 55%)` | `hsl(263 85% 70%)` | AI, architecture |
| Alert amber | `hsl(39 92% 42%)` | `hsl(43 96% 58%)` | Review, warnings |

Typography uses `Inter`/system sans for reading and `JetBrains Mono`/system mono for paths, shortcuts, statuses, timestamps, and technical parameters. Body copy is 16 px with a 1.8 line-height and a maximum width of 72 characters. Frequently used labels remain 14 px or larger; 10–12 px is restricted to secondary metadata.

Spacing follows a 4 px base: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`. The default radius is 10 px; controls use 6–8 px, panels 10–12 px, and modal surfaces 16 px. Shadows are restrained: one inner highlight plus a broad, low-opacity black falloff. Focus uses a 2 px emerald ring with 2 px offset.

### Component library

- **Command palette:** Radix dialog, global `Ctrl/Cmd+K`, search/AI modes switched with `Tab`, exact keyboard hints, indexed workspace results, permission-safe AI response placeholder, and sync state.
- **Interactive code block:** language/status header, high-contrast syntax palette, copy confirmation, horizontal scrolling, and a 520 px maximum height.
- **Callout card:** semantic warning or architecture treatment, native `details/summary`, keyboard operation, expandable content, and distinct amber/indigo signals.
- **Floating ToC:** sticky right rail, heading-depth indentation, scroll targets, section count, and reading-progress indicator.
- **Process node card:** typed nodes, state-colored borders, directional connectors, compact metadata, and selectable dependency context.

## 2. Core layout and component architecture

Desktop uses a fixed 272 px navigation rail, a 64 px command/status header, a fluid main region, and an optional 240 px contextual rail. Reader copy remains centered at 72ch. The dashboard exposes operational metrics and knowledge bases in the first viewport. At widths below 768 px the primary navigation is removed from flow; header actions and content stack without horizontal overflow. The reader ToC hides below the large breakpoint.

```text
AppShell
├── Sidebar: workspace → spaces → page groups → tools
└── Work area
    ├── Navbar: command search → health → theme → notifications → identity
    └── Route surface
        ├── Dashboard: metrics → bases → review queue → activity
        ├── Space: hierarchy → filtered page list
        └── Document: breadcrumb → modes → metadata → reader/editor/graph → ToC
```

Interaction states:

- Hover changes one property family at a time: border emphasis, low-opacity surface, or a 2 px directional shift.
- Active navigation uses emerald text, a 10% tint, and a 2 px inset rail; color is never the only signal.
- Focus is always visible and never suppressed without an equivalent custom ring.
- Loading preserves layout with pulse skeletons; no full-page spinner is used after shell entry.
- Errors are inline, specific, and keep retry/navigation available.
- Save state distinguishes saving, saved timestamp, draft, and failure without blocking editing.
- Reduced-motion preferences collapse animation and smooth scrolling to near-zero duration.

## 3. Front-end implementation specification

The implementation stays on React 18, TypeScript, Vite, Tailwind CSS, Radix primitives, Lucide icons, TipTap, React Markdown, and Lowlight. It adds no competing UI framework. Shared color variables are defined in `apps/web/src/index.css`; layout primitives live in `apps/web/src/components/layout`; rendering behavior remains in `apps/web/src/components/editor`.

The command palette is a controlled Radix dialog. It listens for `Ctrl/Cmd+K`, filters authorized spaces locally, navigates through React Router, and reserves AI mode for a permission-aware search service. Production AI responses must return `{answer, sources[], sectionAnchors[], permissionScope, generatedAt}` and must not expose chunks the user cannot retrieve directly.

Reader modes are explicit state: `preview | graph | edit`. Preview renders Markdown and attachments; graph exposes document relationships; edit uses TipTap and the existing autosave/publish contract. Mermaid fences are rendered as a safe visual flow. A production Mermaid upgrade should use strict security mode, sanitize labels, avoid raw HTML, and lazy-load the renderer.

Motion uses 150–220 ms for hover/focus transitions and 300–350 ms for dialog/surface entry. Status pulses may run at 2.6 s only for live state. Transform-based movement is limited to 2–7 px and disabled by `prefers-reduced-motion`.

Accessibility requirements:

- Maintain AAA contrast for body text and critical controls; validate both themes with automated and manual checks.
- Every icon-only control has an accessible label.
- All dialogs trap focus, close with Escape, and restore focus to the trigger.
- Native headings and landmarks preserve a meaningful document outline.
- Tap targets are at least 44 × 44 px on compact layouts.
- Zoom to 200% must not hide actions, overlap text, or introduce two-dimensional scrolling.
- Status never relies on color alone; pair it with text and/or iconography.

## 4. UX innovations

1. **Permission-aware answer-to-section:** command search can switch into AI mode without leaving the current task. Each answer must cite internal pages and deep-link to the exact heading, while enforcing the same authorization as direct page access.
2. **Operational dependency graph:** every document can switch to a graph that combines hierarchy, internal links, service mentions, owners, and attachments. Engineers can isolate incoming/outgoing dependencies before modifying a runbook or decommissioning a service.
3. **Documentation health queue:** ownership, review SLA, broken references, and incident criticality produce a review priority. The dashboard turns knowledge maintenance into an operational queue instead of an undifferentiated list of stale pages.

Recommended next backend contracts are global search with section anchors, page version/diff routes using the existing shared types, document-link extraction, and a health score materialized per page. These extend the current contract without changing authoring, role, attachment, or hierarchy semantics.
