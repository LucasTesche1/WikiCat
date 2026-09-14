import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useBlocker, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, ChevronRight, Clock3, Code2, Eye, GitBranch, History, Maximize2, Minimize2, PencilLine, Plus, Upload, X } from 'lucide-react';
import type { Attachment, PageTagStub, PageTreeNode, PageWithRelations } from '@wikicat/shared';
import { api, ApiError } from '../api/client';
import { useAuthStore, hasRole } from '../store/useAuthStore';
import { useWorkspace } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../components/ui/Dialog';
import { AttachmentList, PageRenderer } from '../components/editor/PageRenderer';
import { DocumentRelations, HistoryPanel, RunbookCheckpoints } from '../components/editor/DocumentContext';
import { SaveQueue } from '../lib/saveQueue';
const TipTapEditor = lazy(() => import('../components/editor/TipTapEditor').then(m => ({ default: m.TipTapEditor })));
function ancestors(nodes: PageTreeNode[], id: string): PageTreeNode[] {
  for (const n of nodes) { if (n.id === id) return [n]; const child = ancestors(n.children,id); if (child.length) return [n,...child]; } return [];
}
export default function PageEditorPage() { const {id,slug} = useParams(); return <DocumentWorkspace key={id} id={id!} slug={slug!} />; }
function DocumentWorkspace({ id, slug }: { id: string; slug: string }) {
  const user = useAuthStore(s => s.user), canWrite = hasRole(user,['editor','admin']);
  const workspace = useWorkspace();
  const [params,setParams] = useSearchParams();
  const requested = params.get('view') ?? 'read', mode = requested === 'edit' && canWrite ? 'edit' : requested === 'relations' ? 'relations' : 'read';
  const [page,setPage] = useState<PageWithRelations | null>(null), [tree,setTree] = useState<PageTreeNode[]>([]), [attachments,setAttachments] = useState<Attachment[]>([]);
  const [title,setTitle] = useState(''), [markdown,setMarkdown] = useState(''), [tags,setTags] = useState<PageTagStub[]>([]), [tag,setTag] = useState('');
  const [loading,setLoading] = useState(true), [error,setError] = useState(''), [retry,setRetry] = useState(0);
  const [dirty,setDirty] = useState(false), [busy,setBusy] = useState(false), [saveMessage,setSaveMessage] = useState(''), [conflict,setConflict] = useState(false);
  const [autosavePaused,setAutosavePaused] = useState(false), [hasEdited,setHasEdited] = useState(mode === 'edit');
  const [historyOpen,setHistoryOpen] = useState(false), [section,setSection] = useState<string>();
  const [uploadOpen,setUploadOpen] = useState(false), [file,setFile] = useState<File | null>(null), [large,setLarge] = useState(false), [uploading,setUploading] = useState(false), [uploadError,setUploadError] = useState('');
  const uploadAbort = useRef<AbortController | null>(null), queue = useRef(new SaveQueue()), mounted = useRef(true);
  const buffer = useRef({title:'',markdown:'',revision:0}), acknowledged = useRef(0), stamp = useRef('');
  const blocker = useBlocker(({ currentLocation,nextLocation }) => (dirty || busy) && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => { mounted.current=true; return () => { mounted.current=false; uploadAbort.current?.abort(); }; }, []);
  useEffect(() => {
    const ac = new AbortController(); setLoading(true); setError('');
    Promise.all([api.pages.get(id,ac.signal),api.spaces.tree(slug,ac.signal),api.pages.attachments(id,ac.signal)]).then(([p,t,a]) => {
      if (ac.signal.aborted) return;
      const md=p.isDraft ? p.draftMarkdown ?? p.contentMarkdown : p.contentMarkdown;
      setPage(p); setTree(t); setAttachments(a); setTitle(p.title); setMarkdown(md); setTags(p.tags);
      buffer.current={title:p.title,markdown:md,revision:0}; acknowledged.current=0; stamp.current=new Date(p.updatedAt).toISOString(); setDirty(false); setConflict(false);
    }).catch(e => { if (!ac.signal.aborted) setError(e instanceof Error ? e.message : 'Falha ao carregar o documento.'); }).finally(() => { if (!ac.signal.aborted) setLoading(false); });
    return () => ac.abort();
  }, [id,slug,retry]);
  useEffect(() => { if (mode === 'edit') setHasEdited(true); }, [mode]);
  const edit = (field:'title'|'markdown',value:string) => { buffer.current={...buffer.current,[field]:value,revision:buffer.current.revision+1}; if(field==='title')setTitle(value);else setMarkdown(value);setDirty(true);setAutosavePaused(false);setSaveMessage('Alterações não salvas'); };
  const save = useCallback((publish=false) => {
    const snapshot={...buffer.current};
    return queue.current.enqueue(async () => {
      if (!mounted.current || !canWrite) return false;
      if (!publish && snapshot.revision <= acknowledged.current) return true;
      if (!snapshot.title.trim()) { setError('O título não pode ficar vazio.'); return false; }
      setBusy(true); setError(''); setSaveMessage(publish ? 'Publicando…' : 'Salvando rascunho…');
      try {
        const updated=await api.pages.update(id,{title:snapshot.title,draftMarkdown:snapshot.markdown,isDraft:!publish,expectedUpdatedAt:stamp.current,...(publish ? {contentMarkdown:snapshot.markdown} : {})});
        if (!mounted.current) return true;
        stamp.current=new Date(updated.updatedAt).toISOString(); acknowledged.current=snapshot.revision;
        setPage(p=>p ? {...p,...updated,updatedByUser:{id:user!.id,name:user!.name}} : p);
        const newer=buffer.current.revision!==snapshot.revision;setDirty(newer);setConflict(false);
        setAutosavePaused(false);
        setSaveMessage(newer ? 'Há novas alterações não salvas' : `${publish ? 'Publicado' : 'Rascunho salvo'} às ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`);
        workspace.refresh(); return true;
      } catch(e) { if(mounted.current){setError(e instanceof Error ? e.message : 'Não foi possível salvar.');setSaveMessage('Falha ao salvar · conteúdo preservado');setAutosavePaused(true);if(e instanceof ApiError && e.status===409)setConflict(true);}return false;
      } finally { if(mounted.current)setBusy(false); }
    });
  },[id,canWrite,user,workspace.refresh]);
  const saveRef=useRef(save);saveRef.current=save;
  useEffect(() => { if(!dirty || conflict || busy || autosavePaused)return;const timer=window.setTimeout(()=>void saveRef.current(false),3000);return()=>window.clearTimeout(timer); },[markdown,title,dirty,conflict,busy,autosavePaused]);
  useEffect(() => { const leave=(e:BeforeUnloadEvent)=>{if(dirty||busy){e.preventDefault();e.returnValue='';}}; const key=(e:KeyboardEvent)=>{if(canWrite&&mode==='edit'&&!e.isComposing&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(!conflict)void saveRef.current(false);}};window.addEventListener('beforeunload',leave);window.addEventListener('keydown',key);return()=>{window.removeEventListener('beforeunload',leave);window.removeEventListener('keydown',key);};},[dirty,busy,canWrite,mode,conflict]);
  const upload = async (selected:File,tier:boolean) => {const ac=new AbortController();uploadAbort.current=ac;setUploading(true);setUploadError('');try{const a=await (tier?api.attachments.uploadLarge:api.attachments.uploadStandard)(id,selected,ac.signal);if(mounted.current&&!ac.signal.aborted){setAttachments(list=>[...list,a]);setUploadOpen(false);setFile(null);}}catch(e){if(mounted.current)setUploadError(ac.signal.aborted?'Upload cancelado.':e instanceof Error?e.message:'Falha no upload.');}finally{if(mounted.current)setUploading(false);uploadAbort.current=null;}};
  const addTag=async()=>{if(!tag.trim())return;try{const added=await api.pages.tags.add(id,{name:tag.trim()});setTags(t=>t.some(v=>v.id===added.id)?t:[...t,added]);setTag('');}catch(e){setError(e instanceof Error?e.message:'Falha ao adicionar tag.');}};
  if(loading)return <div role="status" className="py-20 text-center text-sm text-muted-foreground">Carregando documento…</div>;
  if(!page)return <section className="technical-panel rounded-xl p-8"><h1 className="text-xl font-semibold">Documento indisponível</h1><p role="alert" className="my-4 text-sm">{error}</p><Button onClick={()=>setRetry(v=>v+1)}>Tentar novamente</Button></section>;
  const crumbs=ancestors(tree,id), space=workspace.spaces.find(s=>s.slug===slug);
  return <div className="space-y-6 pb-12">
    <nav aria-label="Caminho do documento" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><Link to={`/s/${slug}`} className="inline-flex min-h-11 items-center gap-2 hover:underline"><ArrowLeft size={15} />{space?.name??slug}</Link>{crumbs.map((n,i)=><span key={n.id} className="flex items-center gap-2"><ChevronRight size={13}/>{i===crumbs.length-1?<span aria-current="page" className="max-w-60 truncate text-foreground">{n.title}</span>:<Link className="inline-flex min-h-11 items-center hover:underline" to={`/s/${slug}/p/${n.id}`}>{n.title}</Link>}</span>)}</nav>
    <header className="border-b border-border pb-6"><div className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-primary"><FileBadge />DOCUMENTAÇÃO <span className="text-muted-foreground">/ {page.isDraft ? 'RASCUNHO' : 'PUBLICADA'}</span></div>
      {mode==='edit'?<><label className="sr-only" htmlFor="document-title">Título do documento</label><Input id="document-title" value={title} onChange={e=>edit('title',e.target.value)} className="!h-auto !py-3 !text-3xl font-semibold"/></>:<h1 className="max-w-4xl break-words text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground"><span className="inline-flex items-center gap-2"><Clock3 size={15}/>{new Date(page.updatedAt).toLocaleString('pt-BR')}</span><span>por {page.updatedByUser.name}</span><span className="font-mono">{Math.max(1,Math.ceil(markdown.split(/\s+/).length/220))} min de leitura</span></div>
      <div className="mt-4 flex flex-wrap items-center gap-2">{tags.map(t=><span key={t.id} className="inline-flex items-center rounded-md border border-border bg-card text-sm"><Link className="inline-flex min-h-11 items-center gap-2 px-3" to={`/s/${slug}/tag/${encodeURIComponent(t.name)}`}><span className="h-2 w-2 rounded-full" style={{background:t.color}}/>{t.name}</Link>{canWrite&&mode==='edit'&&<button className="workspace-icon" aria-label={`Remover tag ${t.name}`} onClick={()=>void api.pages.tags.remove(id,t.name).then(()=>setTags(a=>a.filter(v=>v.id!==t.id))).catch(e=>setError(e.message))}><X size={14}/></button>}</span>)}{canWrite&&mode==='edit'&&<form onSubmit={e=>{e.preventDefault();void addTag();}} className="flex max-w-full gap-2"><Input aria-label="Nova tag" value={tag} onChange={e=>setTag(e.target.value)} placeholder="Adicionar tag" minLength={2} maxLength={64}/><Button type="submit" variant="outline" aria-label="Adicionar tag"><Plus size={16}/></Button></form>}</div>
    </header>
    <div className="document-tools flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card p-1" role="group" aria-label="Visualização do documento">{([{key:'read',label:'Ler',Icon:Eye},{key:'relations',label:'Relações',Icon:GitBranch},...(canWrite?[{key:'edit',label:'Editar',Icon:PencilLine}]:[])]).map(({key,label,Icon})=><button key={key} aria-pressed={mode===key} onClick={()=>{const next=new URLSearchParams(params);next.set('view',key);setParams(next,{replace:true});}} className={`flex min-h-11 items-center gap-2 rounded-md px-4 text-sm ${mode===key?'bg-muted font-semibold text-primary':'text-muted-foreground hover:bg-muted'}`}><Icon size={16}/>{label}</button>)}</div><div className="flex flex-wrap items-center gap-2"><Button variant="outline" onClick={()=>{setSection(undefined);setHistoryOpen(true);}}><History size={16}/>Histórico</Button><Button variant="outline" onClick={()=>workspace.setFocus(!workspace.focus)} aria-label={workspace.focus?'Sair da tela cheia':'Ver documento em tela cheia'}>{workspace.focus?<Minimize2 size={16}/>:<Maximize2 size={16}/>}<span className="hidden sm:inline">{workspace.focus?'Sair da tela cheia':'Tela cheia'}</span></Button>{mode==='edit'&&<><Button variant="outline" disabled={busy||conflict} onClick={()=>dirty?void save(false):setSaveMessage('Sem alterações pendentes para salvar')}>Salvar</Button><Button disabled={busy||conflict} onClick={()=>void save(true).then(ok=>{if(ok){const next=new URLSearchParams(params);next.set('view','read');setParams(next,{replace:true});}})}><Check size={16}/>Publicar</Button></>}</div></div>
    <p role="status" className="!mt-3 min-h-5 text-sm text-muted-foreground">{saveMessage || (page.isDraft ? 'Este documento possui um rascunho. A busca consulta o conteúdo publicado.' : 'Conteúdo publicado, disponível para a equipe.')}</p>
    {error&&<div role="alert" className="rounded-xl border border-destructive bg-card p-4 text-sm text-destructive"><p>{error}</p>{conflict?<div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" onClick={()=>void navigator.clipboard.writeText(markdown).then(()=>setSaveMessage('Rascunho copiado')).catch(()=>setError('Selecione e copie o texto no editor antes de recarregar.'))}>Copiar meu rascunho</Button><Button variant="outline" onClick={()=>{if(window.confirm('Recarregar a versão do servidor? Copie seu rascunho antes de continuar.'))setRetry(v=>v+1);}}>Recarregar versão do servidor</Button></div>:<Button variant="outline" onClick={()=>void save(false)}>Tentar salvar novamente</Button>}</div>}
    {mode==='relations'?<DocumentRelations markdown={markdown} title={title} slug={slug} tree={tree} pageId={id}/>:mode==='read'?<><RunbookCheckpoints pageId={id} markdown={markdown} userId={user!.id}/><PageRenderer markdown={markdown} attachments={attachments} onSectionHistory={sectionId=>{setSection(sectionId);setHistoryOpen(true);}}/></>:null}
    {canWrite&&hasEdited&&<div hidden={mode!=='edit'}><Suspense fallback={<p role="status">Carregando editor…</p>}><TipTapEditor value={markdown} onChange={v=>edit('markdown',v)} editable={mode==='edit'} onAddAttachmentStandard={f=>upload(f,false)} onAddAttachmentLarge={()=>{setLarge(true);setFile(null);setUploadError('');setUploadOpen(true);}}/></Suspense><div className="mt-4 flex gap-3"><Button variant="outline" onClick={()=>{setLarge(false);setFile(null);setUploadError('');setUploadOpen(true);}}><Upload size={16}/>Anexar arquivo</Button></div>{uploading&&<p role="status" className="mt-3 text-sm">Enviando arquivo…</p>}{uploadError&&<p role="alert" className="mt-3 text-sm text-destructive">{uploadError}</p>}<AttachmentList attachments={attachments}/></div>}
    <HistoryPanel pageId={id} current={markdown} open={historyOpen} onOpenChange={setHistoryOpen} sectionId={section} onRestore={canWrite&&!dirty&&!busy?async versionId=>{await api.pages.restore(id,versionId,stamp.current);setRetry(v=>v+1);}:undefined}/>
    <Dialog open={uploadOpen} onOpenChange={v=>{if(!v)uploadAbort.current?.abort();setUploadOpen(v);}}><DialogContent><DialogTitle>Enviar {large?'anexo grande':'arquivo'}</DialogTitle><DialogDescription>{large?'ISOs, backups e artefatos no armazenamento separado. Limite padrão: 2 GB.':'Arquivos de até 20 MB. Anexos maiores usam o armazenamento separado.'}</DialogDescription><label htmlFor="attachment-file" className="text-sm font-medium">Arquivo</label><Input id="attachment-file" type="file" disabled={uploading} onChange={e=>setFile(e.target.files?.[0]??null)}/>{file&&<p className="break-all text-sm">{file.name} · {(file.size/1048576).toFixed(1)} MB</p>}{uploadError&&<p role="alert" className="text-sm text-destructive">{uploadError}</p>}<div className="flex flex-wrap gap-2"><Button disabled={!file||uploading} onClick={()=>file&&void upload(file,large)}>{uploading?'Enviando…':'Enviar'}</Button><Button variant="outline" onClick={()=>{uploadAbort.current?.abort();setUploadOpen(false);}}>Cancelar</Button>{!large&&<Button variant="outline" onClick={()=>setLarge(true)}>Usar anexo grande</Button>}</div></DialogContent></Dialog>
    <Dialog open={blocker.state==='blocked'} onOpenChange={v=>{if(!v&&blocker.state==='blocked')blocker.reset();}}><DialogContent><DialogTitle>Preservar suas alterações</DialogTitle><DialogDescription>Há alterações não salvas neste documento.</DialogDescription><div className="flex flex-wrap gap-2"><Button disabled={busy||conflict} onClick={()=>void save(false).then(ok=>{if(ok&&buffer.current.revision===acknowledged.current&&blocker.state==='blocked')blocker.proceed();})}>Salvar e sair</Button><Button variant="outline" disabled={busy} onClick={()=>blocker.state==='blocked'&&blocker.proceed()}>Descartar e sair</Button><Button variant="outline" onClick={()=>blocker.state==='blocked'&&blocker.reset()}>Continuar editando</Button></div></DialogContent></Dialog>
  </div>;
}
function FileBadge(){return <Code2 size={15}/>;}
