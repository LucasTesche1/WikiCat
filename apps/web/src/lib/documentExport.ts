import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IRunOptions,
} from 'docx';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Content, ContentTable, TDocumentDefinitions } from 'pdfmake/interfaces';
import { parseDocument, nodeText, type MarkdownNode } from '@wikicat/shared';

type ExportInput = { title: string; markdown: string };
type DocxBlock = Paragraph | Table;
type DocxResult = { document: Document; warnings: string[] };
type PdfResult = { definition: TDocumentDefinitions; warnings: string[] };
type TableModel = { rows: { cells: string[]; header: boolean }[] };
type PdfText = string | { text: string; bold?: boolean; italics?: boolean; style?: string };

const WORD_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const HEADING_LEVELS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
];

pdfMake.vfs = (pdfFonts.vfs ?? {}) as Record<string, string>;

export function exportMarkdownFile(input: ExportInput) {
  const body = input.markdown.trimStart().startsWith('#')
    ? input.markdown
    : `# ${input.title.trim() || 'Document'}\n\n${input.markdown}`;
  downloadBlob(new Blob([body], { type: 'text/markdown;charset=utf-8' }), `${filename(input.title)}.md`);
}

export async function exportDocxFile(input: ExportInput) {
  const { document, warnings } = markdownToDocxDocument(input);
  const blob = await Packer.toBlob(document);
  downloadBlob(blob.slice(0, blob.size, WORD_MIME), `${filename(input.title)}.docx`);
  return { warnings };
}

export function exportPdfFile(input: ExportInput) {
  const { definition, warnings } = markdownToPdfDefinition(input);
  pdfMake.createPdf(definition).download(`${filename(input.title)}.pdf`);
  return { warnings };
}

export function markdownToDocxDocument({ title, markdown }: ExportInput): DocxResult {
  const { tree, warnings } = parseMarkdown(markdown, 'DOCX');
  const children: DocxBlock[] = [
    new Paragraph({ text: title.trim() || 'Document', heading: HeadingLevel.TITLE, spacing: { after: 240 } }),
    ...docxBlocks(tree.children ?? [], warnings, 0),
  ];

  return {
    warnings,
    document: new Document({
      numbering: {
        config: [{
          reference: 'wikicat-numbered-list',
          levels: Array.from({ length: 9 }, (_, level) => ({
            level,
            format: LevelFormat.DECIMAL,
            text: `%${level + 1}.`,
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
          })),
        }],
      },
      sections: [{ properties: {}, children }],
    }),
  };
}

export function markdownToPdfDefinition({ title, markdown }: ExportInput): PdfResult {
  const { tree, warnings } = parseMarkdown(markdown, 'PDF');
  const content = pdfBlocks(tree.children ?? [], warnings, 0);
  return {
    warnings,
    definition: {
      pageSize: 'A4',
      pageMargins: [48, 72, 48, 64],
      header: currentPage => ({ text: title, margin: [48, 28, 48, 0], color: '#64748B', fontSize: 9 }),
      footer: (currentPage, pageCount) => ({
        columns: [{ text: 'WikiCat', color: '#64748B' }, { text: `${currentPage} / ${pageCount}`, alignment: 'right', color: '#64748B' }],
        margin: [48, 0, 48, 24],
        fontSize: 9,
      }),
      content: [{ text: title.trim() || 'Document', style: 'title' }, ...content],
      defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.25, color: '#111827' },
      styles: {
        title: { fontSize: 24, bold: true, margin: [0, 0, 0, 16] },
        h1: { fontSize: 20, bold: true, margin: [0, 14, 0, 8] },
        h2: { fontSize: 16, bold: true, margin: [0, 12, 0, 7] },
        h3: { fontSize: 14, bold: true, margin: [0, 10, 0, 6] },
        h4: { fontSize: 12, bold: true, margin: [0, 8, 0, 5] },
        code: { font: 'Roboto', fontSize: 9, background: '#F8FAFC', margin: [0, 4, 0, 8] },
        inlineCode: { font: 'Roboto', background: '#F8FAFC' },
        tableHeader: { bold: true, fillColor: '#E2E8F0' },
      },
    },
  };
}

function parseMarkdown(markdown: string, format: 'DOCX' | 'PDF') {
  try {
    return { tree: parseDocument(markdown).tree, warnings: [] as string[] };
  } catch (error) {
    console.warn(`${format} export markdown parse failed; using plain text fallback.`, error);
    return {
      tree: { type: 'root', children: [{ type: 'code', value: markdown }] } as MarkdownNode,
      warnings: [`A sintaxe Markdown nao pode ser interpretada completamente; o ${format} usou text simples.`],
    };
  }
}

function docxBlocks(nodes: MarkdownNode[], warnings: string[], listLevel: number): DocxBlock[] {
  return nodes.flatMap(node => docxBlock(node, warnings, listLevel));
}

function docxBlock(node: MarkdownNode, warnings: string[], listLevel: number): DocxBlock[] {
  switch (node.type) {
    case 'heading':
      return [new Paragraph({ children: docxInlineRuns(node.children ?? [], warnings), heading: HEADING_LEVELS[Math.min(Math.max((node.depth ?? 1) - 1, 0), 5)] })];
    case 'paragraph':
      return [new Paragraph({ children: docxInlineRuns(node.children ?? [], warnings), spacing: { after: 120 } })];
    case 'list':
      return docxList(node, warnings, listLevel);
    case 'code':
      return String(node.value ?? '').split('\n').map(line => new Paragraph({ children: [docxCodeRun(line || ' ')], spacing: { before: 80, after: 80 } }));
    case 'table':
      return [docxTable(markdownTable(node, warnings))];
    case 'html': {
      const table = htmlTable(node.value ?? '', warnings);
      return table ? [docxTable(table)] : fallbackDocx(node, warnings);
    }
    case 'blockquote':
      warnings.push('Citacoes foram exportadas com recuo simples no DOCX.');
      return [new Paragraph({ children: docxInlineRuns([{ type: 'text', value: nodeText(node) }], warnings), indent: { left: 360 } })];
    case 'thematicBreak':
      return [new Paragraph({ children: [new TextRun('---')] })];
    default:
      return fallbackDocx(node, warnings);
  }
}

function docxList(node: MarkdownNode, warnings: string[], listLevel: number) {
  const ordered = Boolean((node as MarkdownNode & { ordered?: boolean }).ordered);
  return (node.children ?? []).flatMap(item => {
    const itemChildren = item.children ?? [];
    const firstParagraph = itemChildren.find(child => child.type === 'paragraph');
    const rest = firstParagraph ? itemChildren.filter(child => child !== firstParagraph) : [];
    return [
      new Paragraph({
        children: docxInlineRuns(firstParagraph?.children ?? [{ type: 'text', value: nodeText(item) }], warnings),
        bullet: ordered ? undefined : { level: Math.min(listLevel, 8) },
        numbering: ordered ? { reference: 'wikicat-numbered-list', level: Math.min(listLevel, 8) } : undefined,
      }),
      ...docxBlocks(rest, warnings, listLevel + 1),
    ];
  });
}

function docxTable(table: TableModel) {
  const rows = rectangularRows(table);
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((row, rowIndex) => new TableRow({
      tableHeader: row.header || rowIndex === 0,
      children: row.cells.map(text => new TableCell({
        shading: row.header || rowIndex === 0 ? { type: ShadingType.SOLID, fill: 'E2E8F0', color: 'E2E8F0' } : undefined,
        margins: { top: 100, bottom: 100, left: 120, right: 120 },
        borders: tableBorders(),
        children: [new Paragraph({ children: [new TextRun({ text, bold: row.header || rowIndex === 0 })] })],
      })),
    })),
  });
}

function docxInlineRuns(nodes: MarkdownNode[], warnings: string[], options: IRunOptions = {}): TextRun[] {
  if (!nodes.length) return [new TextRun(options)];
  return nodes.flatMap(node => {
    switch (node.type) {
      case 'text':
        return [new TextRun({ ...options, text: node.value ?? '' })];
      case 'strong':
        return docxInlineRuns(node.children ?? [], warnings, { ...options, bold: true });
      case 'emphasis':
        return docxInlineRuns(node.children ?? [], warnings, { ...options, italics: true });
      case 'inlineCode':
        return [docxCodeRun(node.value ?? '', options)];
      case 'break':
        return [new TextRun({ ...options, break: 1 })];
      case 'link':
        warnings.push('Links foram preservados como text simples no DOCX.');
        return docxInlineRuns(node.children ?? [], warnings, options);
      case 'image':
        warnings.push('Imagens foram preservadas como text alternativo no DOCX.');
        return [new TextRun({ ...options, text: node.value ?? nodeText(node) })];
      default:
        warnings.push(`Formatacao inline "${node.type}" exportada como text simples.`);
        return [new TextRun({ ...options, text: nodeText(node) })];
    }
  });
}

function docxCodeRun(text: string, options: IRunOptions = {}) {
  return new TextRun({ ...options, text, font: 'Consolas', shading: { type: ShadingType.SOLID, color: 'F8FAFC', fill: 'F8FAFC' } });
}

function fallbackDocx(node: MarkdownNode, warnings: string[]) {
  const text = nodeText(node).trim();
  if (!text) return [];
  warnings.push(`Elemento Markdown "${node.type}" exportado como text simples.`);
  return [new Paragraph({ children: [new TextRun(text)] })];
}

function pdfBlocks(nodes: MarkdownNode[], warnings: string[], listLevel: number): Content[] {
  return nodes.flatMap(node => pdfBlock(node, warnings, listLevel));
}

function pdfBlock(node: MarkdownNode, warnings: string[], listLevel: number): Content[] {
  switch (node.type) {
    case 'heading':
      return [{ text: pdfInline(node.children ?? [], warnings), style: `h${Math.min(node.depth ?? 1, 4)}` }];
    case 'paragraph':
      return [{ text: pdfInline(node.children ?? [], warnings), margin: [0, 0, 0, 8] }];
    case 'list':
      return [pdfList(node, warnings, listLevel)];
    case 'code':
      return [{ text: node.value ?? ' ', style: 'code' }];
    case 'table':
      return [pdfTable(markdownTable(node, warnings))];
    case 'html': {
      const table = htmlTable(node.value ?? '', warnings);
      return table ? [pdfTable(table)] : fallbackPdf(node, warnings);
    }
    case 'blockquote':
      warnings.push('Citacoes foram exportadas com recuo simples no PDF.');
      return [{ text: nodeText(node), margin: [16, 0, 0, 8], color: '#475569' }];
    case 'thematicBreak':
      return [{ canvas: [{ type: 'line', x1: 0, y1: 4, x2: 500, y2: 4, lineWidth: 0.5, lineColor: '#CBD5E1' }], margin: [0, 6, 0, 10] }];
    default:
      return fallbackPdf(node, warnings);
  }
}

function pdfList(node: MarkdownNode, warnings: string[], listLevel: number): Content {
  const ordered = Boolean((node as MarkdownNode & { ordered?: boolean }).ordered);
  const items = (node.children ?? []).map(item => pdfInline(item.children?.[0]?.children ?? [{ type: 'text', value: nodeText(item) }], warnings));
  return { [ordered ? 'ol' : 'ul']: items, margin: [Math.min(listLevel, 6) * 12, 0, 0, 8] } as unknown as Content;
}

function pdfTable(table: TableModel): ContentTable {
  const rows = rectangularRows(table);
  const widths = rows[0]?.cells.map(() => '*') ?? ['*'];
  return {
    table: {
      headerRows: rows.length ? 1 : 0,
      widths,
      body: rows.map((row, rowIndex) => row.cells.map(text => ({
        text,
        style: row.header || rowIndex === 0 ? 'tableHeader' : undefined,
        fontSize: 8,
        margin: [3, 3, 3, 3] as [number, number, number, number],
      }))),
    },
    layout: 'lightHorizontalLines',
    margin: [0, 4, 0, 12],
  };
}

function pdfInline(nodes: MarkdownNode[], warnings: string[], options: Partial<Exclude<PdfText, string>> = {}): PdfText[] {
  if (!nodes.length) return [''];
  return nodes.flatMap(node => {
    switch (node.type) {
      case 'text':
        return [{ ...options, text: node.value ?? '' }];
      case 'strong':
        return pdfInline(node.children ?? [], warnings, { ...options, bold: true });
      case 'emphasis':
        return pdfInline(node.children ?? [], warnings, { ...options, italics: true });
      case 'inlineCode':
        return [{ ...options, text: node.value ?? '', style: 'inlineCode' }];
      case 'break':
        return ['\n'];
      case 'link':
        warnings.push('Links foram preservados como text simples no PDF.');
        return pdfInline(node.children ?? [], warnings, options);
      case 'image':
        warnings.push('Imagens foram preservadas como text alternativo no PDF.');
        return [{ ...options, text: node.value ?? nodeText(node) }];
      default:
        warnings.push(`Formatacao inline "${node.type}" exportada como text simples.`);
        return [{ ...options, text: nodeText(node) }];
    }
  });
}

function fallbackPdf(node: MarkdownNode, warnings: string[]): Content[] {
  const text = nodeText(node).trim();
  if (!text) return [];
  warnings.push(`Elemento Markdown "${node.type}" exportado como text simples.`);
  return [{ text, margin: [0, 0, 0, 8] } as Content];
}

function markdownTable(node: MarkdownNode, warnings: string[]): TableModel {
  const rows = (node.children ?? []).map((row, index) => ({
    header: index === 0,
    cells: (row.children ?? []).map(cell => nodeText(cell).trim()),
  }));
  if (!rows.length) warnings.push('Tabela vazia ignorada durante a exportacao.');
  return { rows };
}

function htmlTable(html: string, warnings: string[]): TableModel | null {
  if (!html.toLowerCase().includes('<table')) return null;
  try {
    const document = new DOMParser().parseFromString(html, 'text/html');
    const table = document.querySelector('table');
    if (!table) return null;
    const rows = [...table.querySelectorAll('tr')].map(row => ({
      header: row.querySelector('th') !== null,
      cells: [...row.querySelectorAll('th,td')].map(cell => cell.textContent?.trim() ?? ''),
    })).filter(row => row.cells.length);
    if (!rows.length) throw new Error('HTML table has no rows.');
    return { rows };
  } catch (error) {
    console.warn('HTML table export failed; using fallback text.', error);
    warnings.push('Uma tabela HTML malformada foi exportada como text simples.');
    return null;
  }
}

function rectangularRows(table: TableModel) {
  const width = Math.max(1, ...table.rows.map(row => row.cells.length));
  return table.rows.length
    ? table.rows.map(row => ({ ...row, cells: [...row.cells, ...Array(Math.max(0, width - row.cells.length)).fill('')] }))
    : [{ header: true, cells: [''] }];
}

function tableBorders() {
  return {
    top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
    left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
    right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
    insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
  };
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function filename(title: string) {
  return (title || 'document')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'document';
}
