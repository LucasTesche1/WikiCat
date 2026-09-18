import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { renderToStaticMarkup } from 'react-dom/server';
import { createPortal } from 'react-dom';
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
      copyBtn.innerHTML = '<span class="i-copy"></span><span>Copy</span>';
      const copy = () => {
        const text = node.textContent || '';
        navigator.clipboard?.writeText(text).then(() => {
          copyBtn.innerHTML = '<span class="i-check"></span><span>Copied</span>';
          setTimeout(() => {
            copyBtn.innerHTML = '<span class="i-copy"></span><span>Copy</span>';
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
          node = updatedNode;
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

turndown.addRule('wikicatTable', {
  filter: 'table',
  replacement: (_content: string, node: HTMLElement) => {
    const rows = Array.from(node.querySelectorAll('tr')).map(row =>
      Array.from(row.querySelectorAll('th,td')).map(cell =>
        (cell.textContent || '')
          .replace(/s+/g, ' ')
          .replace(/|/g, '\|')
          .trim(),
      ),
    ).filter(row => row.length);
    if (!rows.length) return '';
    const width = Math.max(...rows.map(row => row.length));
    const normalized = rows.map(row => [...row, ...Array(Math.max(0, width - row.length)).fill('')]);
    const head = normalized[0]!;
    const body = normalized.slice(1);
    const line = (row: string[]) => `| ${row.map(cell => cell || ' ').join(' | ')} |`;
    return `\n\n${line(head)}\n${line(head.map(() => '---'))}${body.length ? `\n${body.map(line).join('\n')}` : ''}\n\n`;
  },
});

function htmlToMarkdown(html: string | null | undefined): string {
  if (!html) return '';
  return turndown.turndown(html);
}

function mdFallbackToHtml(md: string): string {
  return renderToStaticMarkup(<ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>);
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
      aria-label={title}
      aria-pressed={active}
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
  placeholder = 'Start writing. Use the toolbar to format bold text, lists, headings, tables, code blocks, and more.',
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
  const sentinelRef = useRef<HTMLDivElement>(null);
  const sourceOnly = /```mermaid|\[!(?:WARNING|NOTE|TIP)\]|^\s*</im.test(value);
  const [mode, setMode] = useState<'wysiwyg' | 'markdown'>(() => (sourceOnly ? 'markdown' : 'wysiwyg'));
  const [rawMd, setRawMd] = useState<string>(value);
  const [toolbarDocked, setToolbarDocked] = useState(false);
  const [toolbarLeft, setToolbarLeft] = useState(288);
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

  useEffect(() => {
    editor?.setEditable(editable && mode === 'wysiwyg');
  }, [editor, editable, mode]);

  useEffect(() => {
    if (!editable) {
      setToolbarDocked(false);
      return;
    }
    const updateToolbarLeft = () => {
      const hasSidebar = !document.querySelector('.workspace-focus') && window.innerWidth >= 1024;
      setToolbarLeft(hasSidebar ? 288 : 12);
    };
    updateToolbarLeft();
    window.addEventListener('resize', updateToolbarLeft);
    const sentinel = sentinelRef.current;
    if (!sentinel || window.matchMedia('(max-width: 1023px)').matches) {
      setToolbarDocked(false);
      window.removeEventListener('resize', updateToolbarLeft);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setToolbarDocked(!entry.isIntersecting);
      },
      { root: null, threshold: 0, rootMargin: '-88px 0px 0px 0px' },
    );
    observer.observe(sentinel);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateToolbarLeft);
    };
  }, [editable]);

  const switchToVisual = useCallback(() => {
    if (!editor || mode === 'wysiwyg') return;
    suppressOnChange.current = true;
    try {
      editor.commands.setContent(mdFallbackToHtml(rawMd || ''), { emitUpdate: false });
      lastExternalValue.current = rawMd || '';
    } finally {
      suppressOnChange.current = false;
    }
    editor.setEditable(editable);
    setMode('wysiwyg');
    queueMicrotask(() => editor.commands.focus());
  }, [editor, editable, mode, rawMd]);

  const runFormat = useCallback((command: () => boolean) => {
    if (!editor) return;
    if (mode !== 'wysiwyg') {
      switchToVisual();
      requestAnimationFrame(() => command());
      return;
    }
    command();
  }, [editor, mode, switchToVisual]);

  const setLink = useCallback(() => {
    if (!editor) return;
    if (mode !== 'wysiwyg') switchToVisual();
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Paste the URL (https://...) for the selected link:', prev || '');
    if (url == null) return;
    if (url.trim() === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  }, [editor, mode, switchToVisual]);

  const addImageByUrl = useCallback(() => {
    if (!editor) return;
    if (mode !== 'wysiwyg') switchToVisual();
    const url = window.prompt('Image URL (https://...):', '');
    if (!url) return;
    editor.chain().focus().setImage({ src: url.trim() }).run();
  }, [editor, mode, switchToVisual]);

  const insertTable = useCallback(() => {
    if (!editor) return;
    runFormat(() => {
      const inserted = editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      if (inserted) return true;
      return editor.chain().focus().insertContent('<table><thead><tr><th>Header</th><th>Header</th><th>Header</th></tr></thead><tbody><tr><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr></tbody></table><p></p>').run();
    });
  }, [editor, runFormat]);

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
        Loading editor...
      </div>
    );
  }

  const toolbar = (
    <div
      className={cn('wikicat-editor-toolbar flex flex-wrap items-center gap-1 px-2 py-2 border-b border-border bg-muted/40 sticky top-0 z-10', toolbarDocked && 'wikicat-editor-toolbar--docked')}
      style={toolbarDocked ? ({ '--editor-toolbar-left': `${toolbarLeft}px` } as CSSProperties) : undefined}
      role="toolbar"
      aria-label="Editor toolbar"
    >
      <ToolbarBtn title="Undo (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}><Undo className="w-4 h-4" /></ToolbarBtn>
      <ToolbarBtn title="Redo (Ctrl+Y)" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}><Redo className="w-4 h-4" /></ToolbarBtn>
      <Divider />
      <ToolbarBtn title="Heading 1" active={editor.isActive('heading', { level: 1 })} onClick={() => runFormat(() => editor.chain().focus().setHeading({ level: 1 }).run())}><Heading1 className="w-4 h-4" /></ToolbarBtn>
      <ToolbarBtn title="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => runFormat(() => editor.chain().focus().setHeading({ level: 2 }).run())}><Heading2 className="w-4 h-4" /></ToolbarBtn>
      <ToolbarBtn title="Heading 3" active={editor.isActive('heading', { level: 3 })} onClick={() => runFormat(() => editor.chain().focus().setHeading({ level: 3 }).run())}><Heading3 className="w-4 h-4" /></ToolbarBtn>
      <Divider />
      <ToolbarBtn title="Bold (Ctrl+B)" active={editor.isActive('bold')} onClick={() => runFormat(() => editor.chain().focus().toggleBold().run())}><Bold className="w-4 h-4" /></ToolbarBtn>
      <ToolbarBtn title="Italic (Ctrl+I)" active={editor.isActive('italic')} onClick={() => runFormat(() => editor.chain().focus().toggleItalic().run())}><Italic className="w-4 h-4" /></ToolbarBtn>
      <ToolbarBtn title="Underline (Ctrl+U)" active={editor.isActive('underline')} onClick={() => runFormat(() => editor.chain().focus().toggleUnderline().run())}><UnderlineIcon className="w-4 h-4" /></ToolbarBtn>
      <ToolbarBtn title="Strikethrough" active={editor.isActive('strike')} onClick={() => runFormat(() => editor.chain().focus().toggleStrike().run())}><Strikethrough className="w-4 h-4" /></ToolbarBtn>
      <ToolbarBtn title="Highlight" active={editor.isActive('highlight')} onClick={() => runFormat(() => editor.chain().focus().toggleHighlight().run())}><Highlighter className="w-4 h-4" /></ToolbarBtn>
      <ToolbarBtn title="Inline code" active={editor.isActive('code')} onClick={() => runFormat(() => editor.chain().focus().toggleCode().run())}><Code className="w-4 h-4" /></ToolbarBtn>
      <Divider />
      <ToolbarBtn title="Bullet list" active={editor.isActive('bulletList')} onClick={() => runFormat(() => editor.chain().focus().toggleBulletList().run())}><List className="w-4 h-4" /></ToolbarBtn>
      <ToolbarBtn title="Numbered list" active={editor.isActive('orderedList')} onClick={() => runFormat(() => editor.chain().focus().toggleOrderedList().run())}><ListOrdered className="w-4 h-4" /></ToolbarBtn>
      <ToolbarBtn title="Checklist" active={editor.isActive('taskList')} onClick={() => runFormat(() => editor.chain().focus().toggleTaskList().run())}><CheckSquare className="w-4 h-4" /></ToolbarBtn>
      <ToolbarBtn title="Quote" active={editor.isActive('blockquote')} onClick={() => runFormat(() => editor.chain().focus().toggleBlockquote().run())}><Quote className="w-4 h-4" /></ToolbarBtn>
      <ToolbarBtn title="Code block" active={editor.isActive('codeBlock')} onClick={() => runFormat(() => editor.chain().focus().toggleCodeBlock().run())}><Code2 className="w-4 h-4" /></ToolbarBtn>
      <ToolbarBtn title="Horizontal rule" onClick={() => runFormat(() => editor.chain().focus().setHorizontalRule().run())}><Minus className="w-4 h-4" /></ToolbarBtn>
      <Divider />
      <ToolbarBtn title="3x3 table" onClick={insertTable}><TableIcon className="w-4 h-4" /></ToolbarBtn>
      <ToolbarBtn title="Link" active={editor.isActive('link')} onClick={setLink}><LinkIcon className="w-4 h-4" /></ToolbarBtn>
      <ToolbarBtn title="Image URL" onClick={addImageByUrl}><ImageIcon className="w-4 h-4" /></ToolbarBtn>
      {editable && onAddAttachmentStandard && <ToolbarBtn title="Attach image/small file (<=20 MB)" onClick={() => standardInput.current?.click()}><Save className="w-4 h-4" /></ToolbarBtn>}
      <input ref={standardInput} type="file" className="hidden" multiple={false} onChange={onStandardFilePicked} />
      {editable && onAddAttachmentLarge && <ToolbarBtn variant="outline" title="Attach large file (.iso, .sql, dumps, VM...)" onClick={onAddAttachmentLarge}><Save className="w-4 h-4 mr-1" />Large...</ToolbarBtn>}
      <div className="ml-auto flex items-center gap-1 pr-1">
        <ToolbarBtn title={mode === 'wysiwyg' ? 'Copy page markdown' : 'Copy markdown'} onClick={codeCopyToast.trigger}>{codeCopyToast.copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</ToolbarBtn>
        <ToolbarBtn variant={mode === 'wysiwyg' ? 'ghost' : 'outline'} title="Toggle WYSIWYG / raw Markdown" disabled={false} onClick={() => {
          if (mode === 'wysiwyg') { setRawMd(value); setMode('markdown'); }
          else { suppressOnChange.current = true; try { editor.commands.setContent(mdFallbackToHtml(rawMd || ''), { emitUpdate: false }); lastExternalValue.current = rawMd || ''; } finally { suppressOnChange.current = false; } setMode('wysiwyg'); }
        }}>{mode === 'wysiwyg' ? <Code2 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}<span className="ml-1 text-xs">{mode === 'wysiwyg' ? 'Source' : 'Preview'}</span></ToolbarBtn>
      </div>
    </div>
  );

  return (
    <div className={cn('wikicat-editor-shell flex flex-col rounded-xl border border-border bg-background overflow-hidden', toolbarDocked && 'is-toolbar-docked')}>
      <div ref={sentinelRef} className="wikicat-editor-toolbar-sentinel" aria-hidden />
      <div className="wikicat-editor-toolbar-slot">
      {toolbarDocked && typeof document !== 'undefined' ? createPortal(toolbar, document.body) : toolbar}
      </div>

      <div className={cn('flex-1 min-h-[420px]', mode === 'wysiwyg' ? 'bg-background' : 'bg-muted/30 border-t border-border')}>
        {sourceOnly && <p className="border-b border-border px-6 py-3 text-sm text-muted-foreground">Source editing preserves diagrams, callouts, and page extensions.</p>}
        {mode === 'wysiwyg' ? (
          <EditorContent
            editor={editor}
            className="wikicat-editor-surface"
          />
        ) : (
          <textarea
            aria-label="Markdown content"
            value={rawMd}
            spellCheck={false}
            onChange={(e) => {
              const v = e.target.value;
              setRawMd(v);
              onChange(v);
              lastExternalValue.current = v;
            }}
            className="w-full min-h-[520px] px-6 py-4 font-mono text-sm leading-7 bg-transparent resize-y max-w-4xl block mx-auto"
            placeholder="Type Markdown here... return to Preview when finished."
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
