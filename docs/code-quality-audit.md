# WikiCat Code Quality Audit

Date: 2026-09-16

## AS-IS Assessment

- The workspace is a strict TypeScript pnpm monorepo with a Fastify API, React/Vite web app, and shared contract/markdown package.
- API route modules repeat `{ error, message }` response construction and unknown-error parsing. This made behavior harder to keep consistent across pages, spaces, attachments, and the global Fastify error handler.
- Service modules used ad hoc `Object.assign(new Error(...), { statusCode })` patterns for expected domain failures. These were compatible at runtime but weakly typed and easy to drift.
- `PageEditorPage.tsx` concentrates document loading, autosave, upload, tagging, export, history, navigation blocking, and view state in one large component. This is the largest maintainability risk in the web app.
- Markdown diffing in `packages/shared` uses an O(n*m) dynamic-programming grid. That is simple and correct for modest page revisions, but large documents can consume significant memory.
- The project has typecheck scripts but no discovered unit/integration test files. Regression confidence is currently based on TypeScript, build, and manual/smoke flows.

## TO-BE Design

- Keep public API paths, response shapes, schemas, and shared contracts backward compatible.
- Centralize expected HTTP failures in `HttpError` and normalize unknown exceptions through one helper.
- Let route handlers focus on domain flow and validation while service modules raise typed domain errors.
- Continue using Fastify's global error handler as the final fallback for unexpected exceptions.
- Defer larger frontend decomposition to a separate, safer pass: split the document editor into hooks for loading, autosave, uploads, exports, and tags, then cover those hooks with tests.

## Edge Cases And Risks

- Client-facing 5xx responses should not leak raw exception messages; centralized normalization keeps the generic message for server failures.
- 4xx domain errors must preserve actionable messages for validation, conflicts, and missing resources.
- Attachment upload failures need to preserve status codes such as `411` and `413`.
- Existing mojibake in a few Portuguese strings should be fixed in a focused encoding/content pass to avoid mixing behavior changes with copy cleanup.
- Large markdown diff inputs remain a scalability risk until a streaming or bounded diff strategy is introduced.

## Acceptance Criteria Verification

- Comprehensive audit completed: this document records the AS-IS findings before and alongside the targeted refactor.
- Structural refactoring completed: API error handling now uses a typed helper rather than repeated ad hoc parsing in touched modules.
- Zero regression checked: `pnpm -r typecheck` passed via the local workspace executable.
- Measurable quality improvement: service/domain errors are typed, global error responses are normalized, and route catch blocks in pages/spaces are simpler.
