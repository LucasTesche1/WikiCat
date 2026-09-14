import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Minus, CheckSquare, Table as TableIcon, Link as LinkIcon, Image as ImageIcon,
  Undo, Redo, Copy, Check, Code2, Eye, Save, Highlighter,
} from 'lucide-react';
import { Button } from '../ui/Button.js';
import { cn } from '../../lib/utils.js';

const lowlight = createLowlight(common);

const CopyableCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ({ node, editor, getPos }: { node: any; editor: any; getPos: any }) => {
      const dom = document.createElement('div');
      dom.className = 'relative group not-prose rounded-lg border border-border bg-muted/30 my-4 overflow-hidden';
      const header = document.createElement('div');
      header.className = 'flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground border-b border-border bg-muted/50';
      const langLabel = document.createElement('span');
      langLabel.className = 'font-mono uppercase tracking-wide opacity-70';
      langLabel.textContent = (node.attrs.language as string) || 'code';
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className =
        'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-foreground opacity-70 hover:opacity-100 hover:bg-accent transition';
      copyBtn.innerHTML = '<span class="i-copy"></span><span>Copiar</span>';
      const copy = () => {
        const text = (node.textContent || '').replace(/\n$/, '');
        navigator.clipboard?.writeText(text).then(() => {
          copyBtn.innerHTML = '<span class="i-check"></span><span>Copiado</span>';
          setTimeout(() => {
            copyBtn.innerHTML = '<span class="i-copy"></span><span>Copiar</span>';
          }, 1500);
        });
      };
      copyBtn.addEventListener('click', copy);
      header.append(langLabel, copyBtn);
      const pre = document.createElement('pre');
      pre.className = 'p-3 overflow-auto max-h-[520px]';
      const code = document.createElement('code');
      code.className = 'font-mono text-[13px] leading-relaxed';
      pre.append(code);
      dom.append(header, pre);
      return {
        dom,
        contentDOM: code,
        update(updatedNode: any) {
          if (updatedNode.type !== node.type) return false;
          langLabel.textContent = (updatedNode.attrs.language as string) || 'code';
          return true;
        },
        destroy() {
          copyBtn.removeEventListener('click', copy);
        },
      };
    };
  },
}).configure({ lowlight });

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
turndown.use(gfm);
turndown.addRule('taskListItems', {
  filter: (node: HTMLElement) =>
    node.nodeName === 'INPUT' && (node as HTMLInputElement).type === 'checkbox',
  replacement: (_content: string, node: HTMLElement) =>
    (node as HTMLInputElement).checked ? '[x] ' : '[ ] ',
});

function htmlToMarkdown(html: string | null | undefined): string {
  if (!html) return '';
  return turndown.turndown(html);
}

function mdFallbackToHtml(md: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = md.split('\n');
  let html = '';
  let inCode = false;
  let codeBuf: string[] = [];
  let codeLang = '';
  for (const raw of lines) {
    if (/^```/.test(raw)) {
      if (inCode) {
        html += `<pre><code class="language-${esc(codeLang)}">${esc(codeBuf.join('\n'))}</code></pre>`;
        inCode = false;
        codeBuf = [];
        codeLang = '';
      } else {
        inCode = true;
        codeLang = raw.replace(/^```/, '').trim();
      }
      continue;
    }
    if (inCode) { codeBuf.push(raw); continue; }
    let l = raw;
    if (/^### /.test(l)) { html += `<h3>${esc(l.slice(4))}</h3>`; continue; }
    if (/^## /.test(l)) { html += `<h2>${esc(l.slice(3))}</h2>`; continue; }
    if (/^# /.test(l)) { html += `<h1>${esc(l.slice(2))}</h1>`; continue; }
    if (/^> /.test(l)) { html += `<blockquote><p>${esc(l.slice(2))}</p></blockquote>`; continue; }
    if (/^- \[[ x]\] /.test(l)) {
      const checked = l.slice(3, 4) === 'x';
      html += `<ul class="task-list"><li><input type="checkbox" disabled ${checked ? 'checked' : ''}> ${esc(l.slice(6))}</li></ul>`;
      continue;
    }
    if (/^- /.test(l)) { html += `<ul><li>${esc(l.slice(2))}</li></ul>`; continue; }
    if (/^\d+\. /.test(l)) { html += `<ol><li>${esc(l.replace(/^\d+\. /, ''))}</li></ol>`; continue; }
    if (l.trim() === '') continue;
    html += `<p>${esc(l)}</p>`;
  }
  return html;
}

function ToolbarBtn({
  onClick, active, disabled, title, children, variant = 'ghost',
}: {
  onClick?: () => void; active?: boolean; disabled?: boolean; title?: string; children: React.ReactNode; variant?: 'ghost' | 'outline';
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      title={title}
      onMouseDown={(e) => {
        if (!disabled) e.preventDefault();
      }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-8 px-2 rounded-md',
        active && variant === 'ghost' && 'bg-accent text-accent-foreground',
      )}
    >
      {children}
    </Button>
  );
}

function Divider() { return <div className="w-px h-5 bg-border mx-1" aria-hidden />; }

export function TipTapEditor({
  value,
  onChange,
  editable = true,
  placeholder = 'Comece a escrever. Use os botões da barra acima para formatar negrito, listas, títulos, tabelas, blocos de código e mais.',
  onAddAttachmentStandard,
  onAddAttachmentLarge,
}: {
  value: string;
  onChange: (markdown: string) => void;
  editable?: boolean;
  placeholder?: string;
  onAddAttachmentStandard?: (file: File) => Promise<void> | void;
  onAddAttachmentLarge?: () => void;
}) {
  const standardInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'wysiwyg' | 'markdown'>('wysiwyg');
  const [rawMd, setRawMd] = useState<string>(value);
  const lastExternalValue = useRef<string>(value);
  const suppressOnChange = useRef<boolean>(false);
  const sentFromEditorRef = useRef<string | null>(null);
  const lastAppliedExternalRef = useRef<string>(value);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        listItem: { HTMLAttributes: { class: 'list-item-default' } },
      }),
      Underline,
      Highlight.configure({ multicolor: false }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      TaskList.configure({ HTMLAttributes: { class: 'list-none pl-0' } }),
      TaskItem.configure({ nested: true, HTMLAttributes: { class: 'flex items-start gap-2 my-1' } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-primary underline underline-offset-2' } }),
      Image.configure({ inline: true, allowBase64: false, HTMLAttributes: { class: 'max-w-full rounded-md border border-border' } }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader.configure({ HTMLAttributes: { class: 'bg-muted font-semibold text-left' } }),
      TableCell.configure({ HTMLAttributes: { class: 'border border-border p-2 align-top' } }),
      CopyableCodeBlock,
    ],
    [placeholder],
  );

  const editor = useEditor({
    extensions,
    editable,
    content: mdFallbackToHtml(value || ''),
    onUpdate: ({ editor: e }: { editor: any }) => {
      if (suppressOnChange.current) return;
      const md = htmlToMarkdown(e.getHTML());
      sentFromEditorRef.current = md;
      lastExternalValue.current = md;
      lastAppliedExternalRef.current = md;
      onChange(md);
    },
  });

  useEffect(() => {
    if (value === lastAppliedExternalRef.current) return;
    if (sentFromEditorRef.current === value) {
      sentFromEditorRef.current = null;
      lastAppliedExternalRef.current = value;
      lastExternalValue.current = value;
      return;
    }
    lastExternalValue.current = value;
    lastAppliedExternalRef.current = value;
    sentFromEditorRef.current = null;
    if (!editor) return;
    suppressOnChange.current = true;
    try {
      setRawMd(value);
      if (mode === 'wysiwyg') {
        editor.commands.setContent(mdFallbackToHtml(value || ''), { emitUpdate: false });
      }
    } finally {
      suppressOnChange.current = false;
    }
  }, [value, editor, mode]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Cole a URL (https://…) para o link selecionado:', prev || '');
    if (url == null) return;
    if (url.trim() === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  }, [editor]);

  const addImageByUrl = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('URL da imagem (https://…):', '');
    if (!url) return;
    editor.chain().focus().setImage({ src: url.trim() }).run();
  }, [editor]);

  const insertTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  const onStandardFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !onAddAttachmentStandard) return;
    void onAddAttachmentStandard(f);
  };

  const codeCopyToast = useMarkdownCopyToast(mode === 'markdown' ? rawMd : value);

  if (!editor) {
    return (
      <div className="h-40 flex items-center justify-center text-muted-foreground">
        Carregando editor…
      </div>
    );
  }

  editor.setEditable(editable && mode === 'wysiwyg');

  return (
    <div className="flex flex-col rounded-xl border border-border bg-background overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 px-2 py-2 border-b border-border bg-muted/40 sticky top-0 z-10">
        <ToolbarBtn title="Desfazer (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}><Undo className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn title="Refazer (Ctrl+Y)" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}><Redo className="w-4 h-4" /></ToolbarBtn>
        <Divider />
        <ToolbarBtn title="Título 1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn title="Título 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn title="Título 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="w-4 h-4" /></ToolbarBtn>
        <Divider />
        <ToolbarBtn title="Negrito (Ctrl+B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn title="Itálico (Ctrl+I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn title="Sublinhado (Ctrl+U)" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn title="Riscado" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn title="Realçar" active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()}><Highlighter className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn title="Código inline" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}><Code className="w-4 h-4" /></ToolbarBtn>
        <Divider />
        <ToolbarBtn title="Lista" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn title="Lista numerada" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn title="Checklist" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}><CheckSquare className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn title="Citação" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn title="Bloco de código" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Code2 className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn title="Linha horizontal" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="w-4 h-4" /></ToolbarBtn>
        <Divider />
        <ToolbarBtn title="Tabela 3x3" onClick={insertTable}><TableIcon className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn title="Link" active={editor.isActive('link')} onClick={setLink}><LinkIcon className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn title="Imagem (URL)" onClick={addImageByUrl}><ImageIcon className="w-4 h-4" /></ToolbarBtn>
        {editable && onAddAttachmentStandard && (
          <ToolbarBtn title="Anexar imagem/arquivo pequeno (≤20MB)" onClick={() => standardInput.current?.click()}>
            <Save className="w-4 h-4" />
          </ToolbarBtn>
        )}
        <input ref={standardInput} type="file" className="hidden" multiple={false} onChange={onStandardFilePicked} />
        {editable && onAddAttachmentLarge && (
          <ToolbarBtn variant="outline" title="Anexar arquivo grande (.iso, .sql, dumps, VM…)" onClick={onAddAttachmentLarge}>
            <Save className="w-4 h-4 mr-1" />
            Grande…
          </ToolbarBtn>
        )}
        <div className="ml-auto flex items-center gap-1 pr-1">
          <ToolbarBtn
            title={mode === 'wysiwyg' ? 'Copiar markdown da página' : 'Copiar markdown'}
            onClick={codeCopyToast.trigger}
          >
            {codeCopyToast.copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </ToolbarBtn>
          <ToolbarBtn
            variant={mode === 'wysiwyg' ? 'ghost' : 'outline'}
            title="Alternar visualização WYSIWYG ↔ Markdown bruto"
            onClick={() => {
              if (mode === 'wysiwyg') {
                setRawMd(htmlToMarkdown(editor.getHTML()));
                setMode('markdown');
              } else {
                suppressOnChange.current = true;
                try {
                  editor.commands.setContent(mdFallbackToHtml(rawMd || ''), { emitUpdate: false });
                  onChange(rawMd || '');
                  lastExternalValue.current = rawMd || '';
                } finally { suppressOnChange.current = false; }
                setMode('wysiwyg');
              }
            }}
          >
            {mode === 'wysiwyg' ? <Code2 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span className="ml-1 text-xs">{mode === 'wysiwyg' ? 'Fonte' : 'Visualizar'}</span>
          </ToolbarBtn>
        </div>
      </div>

      <div className={cn('flex-1 min-h-[420px]', mode === 'wysiwyg' ? 'bg-background' : 'bg-muted/30 border-t border-border')}>
        {mode === 'wysiwyg' ? (
          <EditorContent
            editor={editor}
            className="[&_.ProseMirror]:outline-none [&_.ProseMirror]:px-6 [&_.ProseMirror]:py-5 [&_.ProseMirror]:min-h-[420px] [&_.ProseMirror]:max-w-3xl [&_.ProseMirror]:mx-auto [&_.is-editor-empty:first-child::before]:text-muted-foreground [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ul_ol]:pl-6 [&_.ProseMirror_blocksquote]:border-l-4 [&_.ProseMirror_blocksquote]:border-primary/40 [&_.ProseMirror_blocksquote]:pl-4 [&_.ProseMirror_blocksquote]:italic [&_.ProseMirror_a]:text-primary [&_.ProseMirror_a]:underline [&_.ProseMirror_a]:underline-offset-2 [&_.ProseMirror_img]:rounded-md [&_.ProseMirror_img]:border [&_.ProseMirror_img]:border-border [&_.ProseMirror_table]:w-full [&_.ProseMirror_table_th]:border [&_.ProseMirror_table_th]:p-2 [&_.ProseMirror_table_td]:p-2 [&_.ProseMirror_table_tr]:border-b"
          />
        ) : (
          <textarea
            value={rawMd}
            spellCheck={false}
            onChange={(e) => {
              const v = e.target.value;
              setRawMd(v);
              onChange(v);
              lastExternalValue.current = v;
            }}
            className="w-full h-[520px] px-6 py-4 font-mono text-sm leading-relaxed bg-transparent outline-none resize-none max-w-3xl block mx-auto"
            placeholder="Digite Markdown aqui… volte para Visualizar quando terminar."
          />
        )}
      </div>
    </div>
  );
}

function useMarkdownCopyToast(md: string) {
  const [copied, setCopied] = useState(false);
  const tRef = useRef<number | null>(null);
  const trigger = () => {
    navigator.clipboard?.writeText(md).then(() => {
      setCopied(true);
      if (tRef.current) window.clearTimeout(tRef.current);
      tRef.current = window.setTimeout(() => setCopied(false), 1500);
    });
  };
  return { copied, trigger };
}

export { htmlToMarkdown, mdFallbackToHtml };
