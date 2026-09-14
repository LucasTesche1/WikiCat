# WikiCat - Product Requirements Document

## Emenda UI-2026-09-13 — implementação autorizada

Autorização: usuário solicitou “Implement” para `docs/ui-ux-blueprint-v2.md`.
Essa especificação detalha o workspace React existente, mantendo rotas, autenticação,
publicação direta e tiers de anexos. Recursos de IA dependem de um serviço local real;
sem essa capacidade, não mostrar respostas simuladas ou controles inoperantes.

- UI-01 (rule): Markdown e código renderizados como texto/AST seguro, com cópia exata,
  ToC derivado do mesmo parser e fallback de diagrama sem perda de conteúdo.
- UI-02 (rule): edição preserva fonte e buffer; saves serializados não descartam novas
  alterações; conflito entre usuários retorna 409; publicar gera snapshot atômico.
- UI-03 (rule): tokens dos dois temas, controles de 44px, foco visível, reduced motion,
  navegação responsiva em todas rotas e ausência de métricas operacionais fictícias.
- UI-04 (rule): paleta global por teclado busca páginas e seções autorizadas; estados
  de erro/vazio/loading distintos e requisições obsoletas descartadas.
- UI-05 (rule): leitor/edição/relações, callouts, diagramas, progresso real, previews,
  histórico/diff e checkpoints fornecem alternativas navegáveis por teclado.
- UI-06 (rule): build e typecheck web/API/shared passam; testes de renderização,
  navegação e persistência com falhas passam. AAA completo exige auditoria manual
  documentada; não declarar conformidade apenas por contraste ou build.


## Overview

- **Summary**: Sistema de documentação web interna (intranet) para equipe de Infraestrutura de TI. Plataforma para criação, organização, busca e leitura de documentação técnica (Linux, processos, conceitos, procedimentos operacionais), com editor rico e buscas rápidas, substituindo o legado de páginas HTML estáticas e evitando o paradigma de arquivos .docx no SharePoint.
- **Purpose**: Eliminar a fragmentação e obsolescência documental atual, centralizando conhecimento em um local único, com experiência moderna de escrita e recuperação de informação, implantado via contêiner no servidor de intranet utilizando Podman.
- **Target Users**:
  - Analistas de Infraestrutura de TI (autores e editores primários)
  - Equipe de Operações / Suporte (leitores frequentes)
  - Novos colaboradores (onboarding e consulta)

---

## Perguntas Explicitamente Formuladas pelo Usuário

**P1. Qual stack tecnológica o sistema deve utilizar?**
**P2. Quais ferramentas utilizar (incluindo banco de dados)?**
**P3. Avaliação geral: o que acha da ideia e da abordagem proposta?**

---

## Análise Detalhada e Resposta Fundamentada (P3)

A ideia é **altamente válida e bem alinhada às dores do contexto**. Avaliação por eixo:

| Eixo | Avaliação | Justificativa |
|------|-----------|---------------|
| **Necessidade real** | 5/5 | Wiki HTML antiga = sem busca, sem versionamento, sem colaboração; SharePoint com .docx = formato inadequado para snippets de código/comandos Linux, difícil indexação, experiência de leitura ruim. |
| **Viabilidade técnica** | 5/5 | Implantação via Podman em intranet é um requisito perfeitamente endereçável. Stacks modernas permitem entrega completa em 1-2 contêineres (app + banco). |
| **Risco de adoção** | 3/5 | Risco moderado: qualquer nova ferramenta depende de migração do conteúdo existente e engajamento da equipe. Mitigação: interface familiar (estilo "Confluence-lite"), importador de HTML legado, busca robusta como "gancho" de adoção. |
| **Custo total de propriedade** | 4/5 | Software livre, sem licenças, rodando em infraestrutura já existente. Baixo custo operacional desde que a stack seja escolhida com critério de simplicidade de manutenção. |
| **Escopo adequado** | 5/5 | O escopo inicial (documentar, buscar, criar) é enxuto e entrega valor rápido. Não há "feature creep" desnecessário. |

**Conclusão**: Projeto com excelente razão esforço/retorno. A dores são concretas, a solução proposta resolve-as diretamente, e a restrição de deploy via Podman é um facilitador (isolamento, reprodutibilidade, rollback fácil).

---

## Goals

1. **Centralizar** toda a documentação de infraestrutura em um único sistema acessível via intranet.
2. **Facilitar a criação** de documentos com editor rico que suporte markdown, blocos de código (destacados por sintaxe), imagens, anexos e formatação avançada.
3. **Habilitar busca rápida e precisa** por conteúdo (título, corpo, tags, código), com resultados em tempo real.
4. **Organizar** documentos por hierarquia (espaços/categorias/páginas) e metadados (tags, autores, datas).
5. **Preservar histórico** de edições para auditoria e reversão.
6. **Implantar e manter via Podman** em servidor de intranet com mínimo esforço operacional.
7. **Executar sob Spec Driven Development (SDD)** ponta a ponta: nenhuma linha de código de produção é escrita antes de especificação formal, critérios de aceite (ACs) e tasks associadas estarem aprovadas e registradas nos artefatos `.trae/specs/`. O spec é a "bíblia" do projeto.
8. **Zero dependências de plataformas pagas**: construir usando exclusivamente software livre / open source e integrações gratuitas, sem chaves de API pagas, licenças ou tier pago em nenhum componente do stack.

---

## Non-Goals

- **Não** é um substituto completo do SharePoint para fluxos de aprovação/formulários corporativos.
- **Não** haverá acesso público externo; uso exclusivo em intranet (pelo menos inicialmente).
- **Não** incluirá chat colaborativo em tempo real, comentários avançados ou gamificação (v1).
- **Não** será um CMS de site público; foco em documentação técnica interna.
- **Não** há suporte nativo a múltiplos idiomas na UI na v1 (conteúdo pode ser em qualquer idioma).
- **Não** integração Active Directory/LDAP na v1 (será uma extensão futura; v1 usa autenticação local simples).
- **Não** adotará em hipótese alguma ferramentas SaaS pagas, APIs com planos pagos, componentes de UI/comerciais (ex: Syncfusion, Telerik), banco de dados com licença comercial, ou qualquer integração que gere custo recorrente ou one-time. Toda a stack é 100% FLOSS (Free/Libre and Open Source Software).
- **Não** se permite a escrita de código de forma ad-hoc fora do fluxo SDD. Toda feature, bugfix e alteração de comportamento deve, antes de implementada, estar descrita no spec (ou em emenda aprovada), ter ACs associadas e tarefa correspondente em tasks.md com requisitos de teste definidos.

---

## Background & Context

- **Legado atual (problema)**: Wiki composta por páginas HTML estáticas. Limitações: (a) sem mecanismo de busca além do `find`/`grep` no servidor; (b) sem editor GUI — exige edição direta de HTML com conhecimentos específicos; (c) sem versionamento nem rastreabilidade de autoria; (d) sem categorização estruturada além de pastas.
- **Alternativa rejeitada**: SharePoint com arquivos .docx. Razões da rejeição: (a) Word é formato inadequado para blocos de código, comandos de terminal e saídas de log; (b) formatação quebra com frequência entre máquinas/versões; (c) busca no SharePoint é orientada a metadados de arquivo e não ao conteúdo técnico; (d) experiência de leitura é a de um processador de texto, não de uma documentação navegável.
- **Restrição de deploy explicitamente declarada**: O sistema rodará em intranet em um servidor utilizando **Podman** (não Docker). Isso implica: imagens OCI compatíveis, uso de `podman-compose` ou manifestos pod, preferência por stacks de imagem única ou poucas imagens, volumes persistentes bem definidos.
- **Perfil do público-alvo**: Usuários técnicos de infraestrutura — confortáveis com CLI, mas apreciam boa UX no dia a dia. Valorizam velocidade de busca, snippets de código copiáveis com um clique, e organização por área técnica.

---

## Stack Tecnológico Recomendado — Resposta às Perguntas P1 e P2

### Critérios de Escolha Aplicados
1. Simplicidade de manutenção por equipe de infraestrutura (poucos componentes, logs claros)
2. Compatibilidade nativa com Podman (imagens OCI levas)
3. Ecossistema maduro para edição/display de markdown e blocos de código
4. Capacidade de full-text search nativa ou facilmente endereçável
5. Performance adequada para uso intranet (dezenas a poucas centenas de usuários simultâneos)
6. Segurança: atualizações frequentes, autenticação em camada única, dependências mínimas

---

### Decisão Final: Stack Recomendada

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| **Linguagem Backend** | **TypeScript + Node.js 22 LTS** | Ecossistema mais rico do mundo para parsers markdown, WYSIWYG headless (TipTap/ProseMirror), syntax highlight (Shiki). Performance excelente para workload I/O-bound que é o grosso de um sistema de docs. Equipe de infra geralmente tem afinidade com JSON/YAML, facilitando manutenção. |
| **Framework Web** | **Fastify** | Alternativa moderna e mais rápida ao Express. Suporte nativo a JSON Schema (validação de entrada forte), plugins oficiais para autenticação/JWT, Swagger automático. Tempo de boot rápido — bom para contêineres. |
| **Linguagem Frontend** | **TypeScript + React 18** | Componentes para editor rico maduros. Design systems como shadcn/ui reduzem esforço de UI. |
| **Build Frontend** | **Vite** | Build extremamente rápido, Hot Module Replacement instantâneo para dev, bundle final otimizado. |
| **UI / Componentes** | **Tailwind CSS + shadcn/ui** | Zero runtime CSS-in-JS, tema consistente, componentes acessíveis, fácil customização. Baixo peso na aplicação final. |
| **Editor de Documentos (WYSIWYG)** | **TipTap** | Headless, baseado em ProseMirror. Renderiza markdown puro por baixo (armazenamos markdown, não HTML proprietário). Extensões para code blocks com syntax highlight (Shiki), tabelas, imagens drag-and-drop, math (opcional). É o editor usado por Notion e Linear. |
| **Banco de Dados** | **PostgreSQL 16** | Resposta direta a P2. **Três motivos decisivos**: (1) **Full-Text Search nativo** com `tsvector/tsquery` e rankings — elimina necessidade de Elasticsearch/Meilisearch na v1 (simplifica arquitetura radicalmente: um contêiner a menos, um serviço a menos para monitorar). (2) Tipo `JSONB` para metadados flexíveis de páginas. (3) Fiabilidade, backup (`pg_dump`), estabilidade — ferramentas que equipe de infra já conhece. |
| **ORM / Query Builder** | **Drizzle ORM** | Mais leve que Prisma, SQL "transparente", geração de migrations type-safe, excelente suporte a features específicas do Postgres (FTS, JSONB). Sem runtime pesado. |
| **Autenticação (v1)** | **JWT com bcrypt + usuários locais** | Tabelas `users` e `roles` no Postgres. Roles mínimos: `admin`, `editor`, `viewer`. Extensão LDAP/AD futura é plugável sem refatorar UI. |
| **Armazenamento de Anexos/Imagens** | **Volume local (filesystem) em DOIS TIERS** via contêiner | Postgres guarda apenas metadados + caminho + `storage_tier` ('standard' ou 'large'). Tier **standard**: volume `wikicat-attachments`, arquivos ≤ 20MB (imagens, PDFs, .conf, zips pequenos). Tier **large**: volume NOMEADO SEPARADO `wikicat-attachments-large` (montado em caminho distinto no contêiner), para arquivos grandes (> 20MB: ISOs, dumps SQL, tarballs, OVAs). Tamanho limite por arquivo large configurável via env `MAX_ATTACHMENT_LARGE_MB` (padrão 2048MB / 2GB). Abstração de caminho no backend permite migrar qualquer um dos tiers para MinIO (S3-compatível) futuramente sem alterar lógica de UI/rotas. |
| **Orquestração Contêineres** | **Podman + podman-compose (YAML 3.x)** | Compatível com sintaxe docker-compose. 3 serviços: `app` (Node.js + frontend servido estaticamente pelo Fastify), `db` (PostgreSQL 16), `reverse-proxy` (Caddy, para TLS autoassinado intranet e gzip). |
| **Imagem Base** | **node:22-bookworm-slim + multi-stage build** | Imagem final ~300MB. Build do front na etapa 1, copia estáticos, executa Fastify na etapa 2 em usuário não-root. |
| **Indexação de Código em Busca** | **pg_trgm + Postgres FTS com dicionário Inglês/Português** | Dá conta de busca por snippets. Caso cresça >50k páginas, adicionar Meilisearch em contêiner separado como upgrade. |

---

### Alternativas Consideradas e Por Que Foram Rejeitadas

| Alternativa | Por que rejeitada |
|-------------|-------------------|
| **Python (FastAPI/Flask)** | Boa escolha válida! Empate técnico com Node. Escolhemos Node.js apenas porque TipTap + Shiki + ecossistema markdown é incomparavelmente mais rico em JS/TS. Se a equipe tiver forte preferência por Python, viável com FastAPI + MkDocs renderer + SQLAlchemy. |
| **Go (Fiber/Gin)** | Performance excelente, binário minúsculo. Rejeitado por: ecossistema de editor frontend WYSIWYG é o mesmo (você ainda precisaria de React/TS), e backend em Go adiciona linguagem extra sem ganho proporcional para este workload. Se houvesse requisito de 10k+ usuários simultâneos, reconsideraríamos. |
| **MongoDB** | Rejeitado: busca full-text é significativamente pior que a do Postgres; schema dinâmico atraente mas FTS nativo é fraco; ferramentas de backup/restore familiares à equipe de infra são menos difundidas que `pg_dump`. |
| **SQLite** | Tentador pela simplicidade (zero contêiner extra). Rejeitado por: sem suporte a consultas full-text concurrentes com escritas (locks de tabela pioram experiência de busca), sem features avançadas (JSONB índices GIN, ranking ponderado). Aceitável para dev local, não para produção. |
| **Elasticsearch / OpenSearch** | Rejeitado para v1: adiciona complexidade operacional (heap de RAM, snapshots, tuning) desnecessária para uma intranet. Postgres FTS + pg_trgm supre 100% da demanda inicial. |
| **Meilisearch** | Ótima ferramenta. Deixado como upgrade futuro se o volume de páginas ultrapassar ~50k ou se a equipe quiser busca por similaridade semântica. |
| **Wiki.js / BookStack / Outline (SaaS self-hosted)** | Excelentes ferramentas prontas! Porém o usuário quer **construir** um sistema, não apenas instalar um produto. Se a decisão mudar para "adotar vs. construir", Wiki.js em Podman é a primeira sugestão. No escopo atual ("buildar"), seguimos com stack customizada. |

---

## Functional Requirements

- **FR-1 Autenticação e Autorização**
  - Cadastro de usuários locais com e-mail + senha (criptografia bcrypt).
  - 3 papéis: `admin` (gerencia tudo), `editor` (cria/edita páginas), `viewer` (apenas lê).
  - Login via página dedicada, sessão persistida via JWT em cookie HttpOnly + Secure + SameSite.
  - Logout com invalidação de token (lista negra em memória + rotação).

- **FR-2 Gerenciamento de Espaços**
  - Criação de "Espaços" (ex: Linux, Rede, Monitoramento, Processos) como agrupadores de páginas.
  - Cada espaço tem nome, slug URL único, descrição, cor e ícone opcional.
  - Listagem de espaços na página inicial com contagem de páginas.

- **FR-3 Hierarquia e Organização de Páginas**
  - Árvore hierárquica de páginas por espaço (páginas pai e filhas, N níveis).
  - Ordenação manual de páginas irmãs via drag-and-drop.
  - Sistema de tags: múltiplas tags por página, filtro por tag, página de listagem por tag.

- **FR-4 Editor de Documentos Rico**
  - Editor WYSIWYG (TipTap) com suporte a: headings (H1-H6), negrito, itálico, listas ordenadas e não ordenadas, tabelas, links internos e externos.
  - Blocos de código com syntax highlight (Shiki) para >20 linguagens (bash, python, yaml, json, sql, nginx, dockerfile, etc.).
  - Botão "copiar código" em cada code block.
  - **Upload de imagens drag-and-drop** (PNG/JPG/SVG/WebP/GIF) → tier standard (≤ 20MB). Renderização inline no editor.
  - **Anexos pequenos** (PDF, .conf, .zip, JSON, txt) → tier standard (≤ 20MB), inseridos como link para download no conteúdo.
  - **Anexos grandes** (ISOs, dumps SQL, tarballs, OVAs, imagens VM, pacotes >20MB) → **modal de upload dedicado via rota tier large**, fora do drag-drop inline do editor; inserido como card de link de download destacado no conteúdo. Sem workflow de revisão: editor/admin publica anexo diretamente (confirmado em OQ-4).
  - Modo "Markdown bruto" para edição rápida para quem preferir.
  - Auto-salvamento a cada 3 segundos em rascunho.
  - **Sem fluxo de aprovação**: qualquer usuário com papel `editor` ou `admin` publica conteúdo e anexos diretamente; não há etapa de "submeter para aprovação" na v1 (confirmado em OQ-4).

- **FR-5 Visualização e Navegação de Páginas**
  - Renderização limpa de páginas com sidebar de TOC (Table of Contents) automática a partir dos headings.
  - Breadcrumb (Espaço > Pai > Filha) no topo de cada página.
  - Índice lateral (sidebar esquerdo) com árvore expandível das páginas do espaço atual.
  - Barra de navegação fixa com busca global, menu do usuário e trocador de espaço.

- **FR-6 Busca Global com Full-Text Search**
  - Barra de busca acessível em qualquer tela via atalho de teclado (Ctrl+K ou Cmd+K).
  - Resultados em tempo real (após 3 caracteres) com trechos de contexto destacados (snippets).
  - Busca em: título, conteúdo, tags, bloco de código.
  - Ranking ponderado: correspondência no título > tags > início do conteúdo > resto.
  - Filtros nos resultados: por espaço, por autor, por data de atualização.
  - Suporte a busca por termos parciais (pg_trgm) para tolerar pequenos erros de digitação.

- **FR-7 Histórico de Edições e Reversão**
  - A cada edição, armazenar snapshot do conteúdo (markdown completo) + autor + timestamp.
  - Página "Histórico" por documento listando todas as versões com diff de alterações (unified diff, com adições em verde e remoções em vermelho).
  - Ação "Restaurar esta versão" disponível para `editor` e `admin`.

- **FR-8 Importação do Legado HTML**
  - Script batch (CLI) para converter páginas HTML legadas em markdown (usando `turndown`) e importar para espaço designado.
  - Preserva estrutura de pastas como hierarquia de páginas.
  - Gera relatório de importação (sucessos, falhas, páginas que exigem revisão manual).

- **FR-9 Perfil e Preferências**
  - Usuário alterar próprio nome, e-mail e senha.
  - Preferência de tema: claro / escuro / sistema.

---

## Non-Functional Requirements

- **NFR-1 Desempenho**
  - Tempo de resposta da busca global (P95) ≤ 400ms com índice de até 10.000 páginas.
  - Carregamento inicial da aplicação (TTI) ≤ 2s em rede LAN de 100Mbps.
  - Suportar 50 usuários simultâneos ativos sem degradação perceptível.

- **NFR-2 Implantação e Operação**
  - Deploy realizado exclusivamente por **Podman**, via arquivo `podman-compose.yml` versionado no repositório.
  - 3 contêineres no máximo (app, db, proxy) — mantendo simplicidade.
  - Imagens OCI construídas via multi-stage, com usuário não-root.
  - Dados persistidos em **3 volumes nomeados** do Podman: `wikicat-db-data` (banco), `wikicat-attachments` (tier standard — pequenos arquivos ≤ 20MB), `wikicat-attachments-large` (tier separado para arquivos grandes; isolado para não consumir espaço do SSD do sistema de forma inesperada).
  - Procedimento de backup documentado: `pg_dump` diário + cópia da pasta attachments.
  - Variáveis de ambiente para toda configuração (nunca credenciais hardcoded).

- **NFR-3 Segurança (Intranet)**
  - Todas as senhas armazenadas com `bcrypt` (custo ≥ 12).
  - Cookies de sessão com flags `HttpOnly`, `Secure` (mesmo em intranet, caso haja TLS), `SameSite=Lax`.
  - Header `Content-Security-Policy` restritivo.
  - Validação estrita de entrada em todos os endpoints (JSON Schema via Fastify).
  - Upload de arquivos em **dois tiers**, cada um com sua whitelist e limites:
    - Tier **standard** (imagens, PDFs, confs, small zips): limite **20MB** por arquivo; whitelist MIME `image/*`, `application/pdf`, `application/json`, `text/*`, `application/zip`, `application/x-gzip`. 
    - Tier **large** (ISOs, dumps de banco, tarballs, imagens VM, arquivos de pacote): limite configurável via env `MAX_ATTACHMENT_LARGE_MB` (padrão **2048MB** / 2GB por arquivo); armazenado no volume separado `wikicat-attachments-large` **nunca** compartilhado com tier standard.
  - Tabela `attachments` recebe coluna adicional `storage_tier` ('standard' | 'large') e `storage_path` reflete o caminho absoluto de seu volume. Rotas de download leem `storage_tier` para resolver o diretório raiz correto.
  - CSRF protection para endpoints state-changing.
  - Logs de eventos: login, edição, exclusão, restauração — com usuário, IP e timestamp.

- **NFR-4 Manutenibilidade**
  - Backend e frontend no **mesmo repositório** (monorepo) com TypeScript compartilhando tipos de API via contrato central.
  - Cobertura de testes unitários para camada de serviço ≥ 70%.
  - Documentação de API OpenAPI/Swagger auto-gerada em `/docs`.
  - Logs estruturados (JSON) no stdout, coletáveis via `podman logs`.

- **NFR-5 Compatibilidade de Navegador**
  - Suporte oficial às últimas 2 versões do Chrome, Firefox e Edge (público corporativo típico).
  - Sem suporte a IE11 ou Safari antigo.

- **NFR-6 Acessibilidade (Nível AA)**
  - Navegação por teclado em toda interface (menus, árvore de páginas, resultados de busca).
  - Contraste WCAG 2.1 AA em temas claro e escuro.
  - ARIA labels corretos em componentes interativos.

- **NFR-7 UX Técnica**
  - Atalhos de teclado documentados (Ctrl+K busca, Ctrl+N nova página, Ctrl+S salvar, `?` mostra ajuda).
  - Snippets de código com botão de "copiar para área de transferência" imediato.
  - Dark mode padrão-opcional (perfil de usuário).

---

## Constraints

- **Technical**:
  - Deploy via **Podman** (não Docker Engine diretamente) conforme declaração do usuário.
  - Execução exclusiva em **intranet**; sem exposição à internet pública.
  - Recursos de servidor modestos assumidos: ~4 GB RAM, 2 vCPUs, SSD de 100GB+ (suficiente para stack proposta).
  - Sem serviços de nuvem externos; tudo on-premises no servidor designado.
  - **100% FLOSS**: Todas as dependências (libraries, runtime, banco, proxy, editor, highlight, ORM, ferramentas de teste) devem ter licença permissiva compatível (MIT, Apache 2.0, BSD, ISC, PostgreSQL). É proibido o uso de qualquer biblioteca ou componente que exija compra, assinatura, ou licença comercial (ex: componentes Syncfusion, Telerik, Kendo, banco Oracle/SQL Server, Algolia paid tier, etc.).
  - Nenhuma integração com APIs de terceiros que exijam plano pago. Integrações opcionais futuras (ex: SSO) devem ser baseadas em protocolos abertos (SAML/OIDC) sem depender de SaaS pago.
  - **Anexos grandes em storage estritamente separado**: arquivos > 20MB são escritos exclusivamente no volume `wikicat-attachments-large`, jamais no volume `wikicat-attachments`. Backend valida e roteia para o tier correto ANTES de começar streaming de bytes, para evitar consumo acidental de espaço do SSD principal. Rota dedicada para upload large (`POST /api/pages/:id/attachments/large`) com validação de role (editor/admin) e tamanho pré-anunciado via header `Content-Length`.

- **Business**:
  - Equipe de infraestrutura é ao mesmo tempo mantenedora e usuária primária — a stack deve ser simples de operar e diagnosticar.
  - Conteúdo legado HTML existente deve ser migrável sem re-escrita manual total.
  - Projeto de tamanho inicial pequeno a médio: não é produto SaaS comercial.
  - **Metodologia obrigatória = Spec Driven Development (SDD) rigoroso**:
    1. Nenhuma implementação inicia sem que o requisito exista em `spec.md` com seu(s) AC(s) do tipo `rule` ou `rubric`.
    2. Nenhuma tarefa é executada sem entrada correspondente em `tasks.md`, com prioridade, dependências e Test Requirements (TRs) definidos.
    3. Alterações de escopo ou comportamento de features já especificadas exigem: (a) emenda ao `spec.md`, (b) atualização dos ACs, (c) ajuste de `tasks.md`, (d) notificação e aprovação do usuário antes da implementação.
    4. Este artefato `spec.md` e o `tasks.md` são a fonte única e exclusiva da verdade sobre o que será construído e como será validado. Qualquer divergência entre código e spec → o código deve ser alterado para coincidir com o spec (ou o spec deve ser emendado via fluxo acima).

- **Dependencies**:
  - Servidor Linux com Podman 4.x+ e `podman-compose` já instalados e operacionais.
  - Acesso à rede da intranet para usuários e DNS/hostname resolvível.
  - (Opcional, recomendado) Certificado TLS emitido pela CA interna da empresa para o proxy Caddy. Sem custo; gerado via infra existente da corporação.

---

## Assumptions

1. O servidor alvo de implantação já possui Podman 4.x ou superior instalado, em distribuição Linux recente (RHEL 9+, Ubuntu 24.04+, Debian 12+).
2. Há espaço em disco suficiente para o banco (crescimento esperado ~5GB/ano para 10k páginas + anexos moderados) + backups.
3. A equipe de infraestrutura tem conhecimento básico de git, conceitos de containers (imagens, volumes, compose YAML) e CLI de Postgres ou disposição para aprender.
4. Na v1, 3 a 15 usuários ativos simultâneos durante horário comercial é o pico esperado.
5. Migração do conteúdo HTML legado será executada uma única vez no início do projeto, com curadoria manual posterior para páginas onde a conversão markdown não for perfeita.
6. Requisitos de conformidade (LGPD, auditoria detalhada de acesso) são mínimos ou atendidos pelos logs existentes; caso contrário, NFR de auditoria precisará ser expandido.

---

## Acceptance Criteria

### AC-1: Autenticação com papéis funciona corretamente
- **Type**: `rule`
- **Given**: Sistema rodando com pelo menos 3 usuários cadastrados com roles admin, editor e viewer
- **When**: Cada um tenta acessar a rota de edição de uma página e a rota de administração de espaços
- **Then**: (a) admin consegue ambas; (b) editor consegue editar mas não administrar espaços; (c) viewer recebe 403 em ambas
- **Pass Condition**: Todos os 6 cenários (2 ações × 3 perfis) retornam status e permissão esperados
- **Evidence**: Suíte de testes E2E cobrindo matriz de permissões + screenshots das respostas 403

### AC-2: Editor persiste e renderiza markdown com blocos de código destacados
- **Type**: `rule`
- **Given**: Editor aberto com permissão de editor
- **When**: Usuário insere headings H1-H3, bloco de código ```bash com 10 linhas de comandos, tabela 3x3 e uma imagem
- **Then**: Ao salvar e reabrir a página, todo o conteúdo é renderizado idêntico à pré-visualização, com syntax highlight correto no bloco bash, e botão copiar funcional no bloco de código
- **Pass Condition**: Conteúdo armazenado em markdown no banco corresponde ao digitado; HTML renderizado contem tags `pre>code` com classes de linguagem; cópia do bloco retorna o texto exato no clipboard
- **Evidence**: Teste E2E com Playwright que digita conteúdo, salva, recarrega, e valida DOM + clipboard

### AC-3: Busca global encontra página por título, conteúdo e código, em < 400ms
- **Type**: `rule`
- **Given**: Banco com 500 páginas de teste, incluindo uma contendo "sudo systemctl restart nginx" em um code block e outra com "Procedimento de Backup do PostgreSQL" no título
- **When**: Usuário aciona Ctrl+K e busca por "nginx restart", e depois por "backup postgres"
- **Then**: (a) resultado retorna em P95 ≤ 400ms medido no cliente; (b) página do nginx aparece no top 5 para "nginx restart"; (c) página do backup aparece em 1º lugar para "backup postgres"; (d) snippets mostram os termos destacados
- **Pass Condition**: P95 ≤ 400ms em 100 requisições concorrentes; rankings corretos; snippets contendo `<mark>` no HTML de resultado
- **Evidence**: Script de carga + relatório de benchmark de busca (k6 ou similar) + captura do DevTools Network

### AC-4: Histórico de edições permite visualizar diff e restaurar versão
- **Type**: `rule`
- **Given**: Página com 3 edições consecutivas por autores diferentes (v1, v2, v3)
- **When**: Editor abre tela de histórico e clica em "Comparar v1 com v3", depois em "Restaurar v2"
- **Then**: Diff mostra linhas adicionadas em verde e removidas em vermelho entre v1 e v3; após restaurar, o conteúdo visualizado é exatamente o da v2, e uma nova entrada v4 (cópia de v2) aparece no histórico com o autor da restauração
- **Pass Condition**: Diff correto por biblioteca `diff` padrão; conteúdo de v2 recuperado byte-for-byte em markdown; nova entrada v4 criada com autor atual
- **Evidence**: Teste de integração que cria edições, compara diffs byte-a-byte, valida inserção de entrada de reversão

### AC-5: Deploy via Podman funciona com podman-compose up -d
- **Type**: `rule`
- **Given**: Repositório clonado em servidor Linux com Podman 4.x+ e podman-compose, arquivo `.env` preenchido com credenciais
- **When**: Executa `podman-compose up -d --build` a partir do zero
- **Then**: (a) 3 contêineres sobem com status healthy em ≤ 2 min; (b) página de login carrega no hostname configurado; (c) volume `wikicat-db-data` é criado e persiste após restart dos contêineres; (d) anexo salvo em anexos persiste em volume `wikicat-attachments`
- **Pass Condition**: `podman ps` mostra 3 contêineres `Up X minutes (healthy)`; curl no endpoint /health retorna {"status":"ok"}; restauração de contêineres preserva dados
- **Evidence**: Gravação de tela de deploy limpo + saída dos comandos de verificação

### AC-6: Importador de legado HTML converte 50 páginas com ≥ 90% de fidelidade
- **Type**: `rubric`
- **Dimension**: Fidelidade e cobertura da importação de conteúdo legado
- **Scale**: 1-5
- **Anchors**: 1 = <50% das páginas importadas ou estrutura perdida; 3 = ≥80% importadas, mas formatação quebrada em muitas; 5 = 100% das páginas importadas, markdown preservando títulos, listas, tabelas, links internos e imagens sem erro
- **Pass Threshold**: >= 4
- **Evidence**: Relatório do script de importação rodado em corpus de 50 páginas HTML legado reais, contando (a) quantidade de páginas processadas sem exceção; (b) inspeção visual aleatória de 10 páginas comparando HTML original vs markdown renderizado

### AC-7: UX de navegação e leitura é considerada boa por usuários técnicos
- **Type**: `rubric`
- **Dimension**: Satisfação de uso para público-alvo (infraestrutura)
- **Scale**: 1-5
- **Anchors**: 1 = Pior que wiki HTML atual; 3 = Par ao SharePoint com Word; 5 = Significativamente melhor que ambos, com atalhos, busca e organização elogiados
- **Pass Threshold**: >= 4
- **Evidence**: Teste com 3 membros reais da equipe utilizando por 3 dias, aplicando questionário SUS (System Usability Scale) + pergunta de NPS em escala 0-10

### AC-8: Temas claro e escuro respeitam contraste WCAG AA
- **Type**: `rule`
- **Given**: Aplicação carregada em tema claro e depois escuro
- **When**: Rodar validador de contraste automático em 10 páginas típicas (início, espaço, página de docs com code blocks dark, formulários)
- **Then**: Todas as combinações texto/fundo relevantes têm contraste ≥ 4.5:1 para texto normal e ≥ 3:1 para texto grande
- **Pass Condition**: 0 falhas de contraste nos componentes verificados
- **Evidence**: Relatório de axe-core ou Lighthouse accessibility rodado em CI

---

## Open Questions

- [ ] **OQ-1**: Há certificado TLS emitido por CA corporativa para o domínio da intranet, ou podemos usar self-signed emitido pelo Caddy? (impacta NFR-2 e config do proxy)
  - **Status (2026-09-07)**: Mantida em aberto por decisão do usuário. Enquanto isso, aplica-se o default do spec: Caddy com `tls internal` (self-signed) automaticamente e opção de montar certificado CA em `/data/certs`.
- [ ] **OQ-2**: Quantas páginas HTML aproximadamente existem no legado a migrar? (define esforço de validação do importador)
  - **Status (2026-09-07)**: Mantida em aberto por decisão do usuário. Importador de Task 12 implementado de forma genérica, com `--dry-run`, relatório JSON e dry-run plan para validação prévia antes de executar em massa.
- [ ] **OQ-3**: Vamos começar com **autenticação local** (senha por usuário) na v1, conforme o spec, ou já há exigência de integração com AD/LDAP desde o lançamento? (impacta FR-1 e cronograma)
  - **Status**: Em aberto (não respondida explicitamente). Não-Goal da v1 (LDAP só em extensão futura) **mantém-se** até segunda ordem; Task 4 implementa auth local, conforme já executado.
- [x] **OQ-4**: Há necessidade de **revisão/aprovação de conteúdo** (workflow: editor submete → admin aprova) ou edição direta está OK? (impacta FR-4 e pode ser adicionado na v1 ou v2)
  - **Resposta (2026-09-07)**: **Edição direta está OK**. NÃO há workflow de revisão/aprovação. Usuários com papel `editor` ou `admin` publicam páginas, anexos standard e anexos large imediatamente — sem estados "pendente de aprovação", sem fila de revisão, sem 4-eye principle. Feature de workflow fica como **não-goal da v1** e só entra numa v2 futura se requisitada explicitamente em nova emenda SDD.
- [ ] **OQ-5**: Orçamento de recursos do servidor: é possível confirmar ≥ 4 GB RAM e 2 vCPUs? Ajuda a dimensionar `shared_buffers` do Postgres e afins.
  - **Status (2026-09-07)**: Mantida em aberto por decisão do usuário. Deploy default do spec (postgres:16-alpine, shared_buffers = 256MB automatic via contêiner) funciona adequadamente em 4GB / 2vCPU. Se o servidor for menor (≤ 2GB), documentar em `docs/deploy.md` ajuste de `PG_SHARED_BUFFERS=128MB` e redução workers no postgresql.auto.conf.
- [x] **OQ-6**: Sobre anexos: haverá arquivos grandes (>100MB) como ISOs, dumps, ou ficarão restritos a PDFs e confs pequenos? (impacta escolha de filesystem vs MinIO)
  - **Resposta (2026-09-07)**: **SIM, haverá arquivos grandes e exigem armazenamento SEPARADO**. Implementação em 2 tiers no mesmo filesystem (camada de abstração garante migração futura transparente para MinIO):
    1. Tier **standard** (wikicat-attachments): imagens, PDFs, confs, zips pequenos — ≤ 20MB.
    2. Tier **large** (wikicat-attachments-large, volume NOMEADO separado, nunca compartilhado): ISOs, dumps SQL, tarballs, pacotes .rpm/.deb, OVAs, imagens raw/disco. Limite padrão por arquivo 2GB via `MAX_ATTACHMENT_LARGE_MB`; override por env.
  - Backend valida `Content-Length` do request antes de iniciar streaming; rejeita prematuramente para não encher volumes. Rotas separadas: `/api/pages/:id/attachments` (standard) e `/api/pages/:id/attachments/large` (large; aceita multipart com header de tier). Anexos são imutáveis em storage path após upload (só soft delete limpa entrada no banco + sinaliza em metadata para rotina de limpeza futura).
