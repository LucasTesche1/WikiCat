# Documentation Export Specification

## Objective

Add a documentation export workflow that lets a reader download the current page as raw Markdown (`.md`), Microsoft Word (`.docx`), or Portable Document Format (`.pdf`) while preserving common Markdown structure and tables in generated document formats.

## Data Flow

1. `PageEditorPage` already loads the active page title and Markdown source into local state.
2. The document toolbar exposes an `Export` menu with three options:
   - `Markdown (.md)`
   - `Microsoft Word (.docx)`
   - `PDF (.pdf)`
3. Markdown export serializes the current Markdown string directly into a browser `Blob` with `text/markdown;charset=utf-8`.
4. DOCX export sends the same Markdown string and page title to a web export utility.
5. The DOCX utility parses Markdown with the shared `parseDocument` helper, which uses `unified`, `remark-parse`, and `remark-gfm`.
6. The parsed Markdown AST is translated into `docx` document children.
7. The parsed Markdown AST is also translated into a `pdfmake` document definition for PDF export.
8. The generated DOCX `Blob` is downloaded with the Open XML MIME type.
9. The generated PDF is downloaded with the PDF MIME type by `pdfmake`.
10. Warnings and fatal failures are returned to the UI so the page can show user-facing status or error text.

## Libraries And Dependencies

- Existing parser:
  - `@wikicat/shared`
  - `unified`
  - `remark-parse`
  - `remark-gfm`
- New browser DOCX generator:
  - `docx`
- New browser PDF generator:
  - `pdfmake`
  - `@types/pdfmake` for TypeScript declarations

The feature does not require server-side generation because the page content is already available in the browser and export is a user-triggered download.

## Component Interfaces

### `downloadBlob(blob, filename)`

Creates a temporary object URL, clicks a hidden anchor, and revokes the URL.

### `exportMarkdownFile({ title, markdown })`

Inputs:

- `title: string`
- `markdown: string`

Behavior:

- Prepends a level-one heading with the page title only when the body does not already begin with `#`.
- Emits `text/markdown;charset=utf-8`.
- Downloads a sanitized filename ending in `.md`.

### `exportDocxFile({ title, markdown })`

Inputs:

- `title: string`
- `markdown: string`

Output:

- `{ warnings: string[] }`

Behavior:

- Parses Markdown into an AST.
- Converts supported Markdown nodes into Word paragraphs/runs.
- Emits the Word MIME type: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
- Downloads a sanitized filename ending in `.docx`.
- Returns warnings when unsupported or lossy Markdown nodes are encountered.

### `exportPdfFile({ title, markdown })`

Inputs:

- `title: string`
- `markdown: string`

Output:

- `{ warnings: string[] }`

Behavior:

- Parses Markdown into an AST.
- Converts supported Markdown nodes into a `pdfmake` document definition.
- Applies consistent page margins, typography, table styling, and running headers/footers.
- Downloads a sanitized filename ending in `.pdf`.
- Returns warnings when unsupported or lossy Markdown nodes are encountered.

### `markdownToDocxDocument({ title, markdown })`

Inputs:

- `title: string`
- `markdown: string`

Output:

- `{ document: Document; warnings: string[] }`

Markdown mappings:

- `heading` depth 1-6 -> native Word heading styles `Heading1` through `Heading6`.
- `paragraph` -> normal paragraph with inline runs.
- `break` -> line break run.
- `list` / `listItem` -> bullet or numbered paragraphs with nesting levels.
- `strong` -> bold text run.
- `emphasis` -> italic text run.
- `inlineCode` -> monospace run with light shading.
- `code` -> monospace paragraph preserving line breaks.
- `table`, `tableRow`, `tableCell` -> native editable Word table with header shading, borders, and cell margins.
- raw HTML `<table>` nodes -> parsed with `DOMParser` and converted to native Word tables when possible.
- Unknown block nodes -> fallback paragraph containing their text content and a warning.

### `markdownToPdfDefinition({ title, markdown })`

Inputs:

- `title: string`
- `markdown: string`

Output:

- `{ definition: TDocumentDefinitions; warnings: string[] }`

Markdown mappings:

- `heading` depth 1-6 -> styled PDF text with stable spacing.
- `paragraph` -> text block with inline bold, italic, and code spans.
- `break` -> line break text.
- `list` / `listItem` -> nested `ul` or `ol` blocks with indentation.
- `code` -> monospaced shaded text block preserving whitespace.
- `table` and raw HTML `<table>` -> PDF table body with repeated header rows, borders, and padded cells.
- Unknown block nodes -> fallback text block containing their readable text and a warning.

## Error Handling

- Markdown parsing errors are caught at the export boundary.
- If parsing fails completely, DOCX export falls back to a plain text document containing the title and raw Markdown.
- If parsing fails completely, PDF export falls back to a plain text PDF containing the title and raw Markdown.
- Unsupported Markdown nodes do not fail export; they are converted to best-effort plain text and logged as warnings.
- Stream/write/package failures are treated as fatal export failures. The download is aborted and the UI displays a clear retry-oriented message.
- The UI status area announces successful exports and warns when the DOCX or PDF was generated with fallback formatting.

## Edge Cases

- Empty Markdown: export title and a blank body without throwing.
- Existing H1: Markdown export avoids duplicating the page title as another H1.
- Malformed Markdown or unclosed formatting: rely on tolerant Markdown parsing, preserve literal text where possible, and warn only if a fallback path is used.
- Deep nested lists: cap DOCX indentation levels to Word-supported practical levels while preserving content.
- Mixed formatting inside list items: convert the first paragraph into the list paragraph and render additional child blocks beneath the same indentation.
- Code fences with language labels: preserve code text; ignore syntax highlighting in DOCX.
- Inline links and images: preserve link text or alt text as plain text and warn because hyperlink/image export is outside this feature scope.
- Markdown tables: calculate the widest row, pad missing cells, and render native table grids.
- HTML tables: parse basic `table`, `thead`, `tbody`, `tr`, `th`, and `td`; if malformed, fallback to readable text and warn.
- Wide tables in PDF: use percentage widths and smaller cell text to prevent hard clipping.
- Long tables in PDF: repeat the first row as a header and allow page breaks between rows.
- Missing table cells: pad with empty cells so DOCX/PDF table engines receive rectangular grids.
- Task lists, unsupported HTML, and thematic breaks: fallback to readable text or separator text with warnings.
- Filename unsafe characters: normalize to lowercase slugs and strip unsupported filesystem characters.

## Acceptance Criteria Verification

- Scenario 1: The toolbar export menu includes Markdown, creates a `.md` Blob using the Markdown MIME type, and downloads clean Markdown text.
- Scenario 2: The DOCX path parses Markdown, maps H1-H6, paragraphs, nested lists, bold, italic, inline code, code blocks, and Markdown/HTML tables to Word constructs.
- Scenario 3: The PDF path parses Markdown, maps formatted content and tables to a stable `pdfmake` layout, and downloads a `.pdf`.
- Scenario 4: Parser or conversion warnings are caught, logged, surfaced in status text, and best-effort DOCX/PDF generation continues.
- Scenario 5: Fatal generation/download failures are caught by the UI handler, no corrupt download is triggered after failure, and an actionable error is shown.
