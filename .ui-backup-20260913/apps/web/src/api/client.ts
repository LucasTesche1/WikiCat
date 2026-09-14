import type {
  AuthLoginRequest,
  AuthMeResponse,
  CreateUserRequest,
  Space,
  SpaceSummary,
  Page,
  PageTreeNode,
  PageWithRelations,
  CreateSpaceRequest,
  CreatePageRequest,
  UpdatePageRequest,
  Attachment,
  AddTagRequest,
  PageTagStub,
  TagWithPageCount,
  TaggedPage,
} from '@wikicat/shared';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T = unknown>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  opts?: { body?: unknown; signal?: AbortSignal; headers?: Record<string, string>; rawBody?: BodyInit },
): Promise<T> {
  const isJson = opts?.body !== undefined;
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    signal: opts?.signal,
    headers: {
      ...(isJson ? { 'Content-Type': 'application/json' } : undefined),
      ...(opts?.headers ?? {}),
    },
    body: isJson ? JSON.stringify(opts.body) : opts?.rawBody,
  });
  const text = await res.text();
  let json: unknown = undefined;
  try {
    if (text) json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const msg =
      json && typeof json === 'object' && 'message' in json && typeof (json as { message?: unknown }).message === 'string'
        ? (json as { message: string }).message
        : `${method} ${path} failed: ${res.status}`;
    throw new ApiError(res.status, msg, json);
  }
  return text ? (json as T) : (undefined as unknown as T);
}

export const api = {
  auth: {
    login: (body: AuthLoginRequest) =>
      request<{ ok: boolean; user: AuthMeResponse }>('POST', '/auth/login', { body }),
    logout: () => request<void>('POST', '/auth/logout'),
    me: () => request<AuthMeResponse>('GET', '/auth/me'),
    register: (body: CreateUserRequest) =>
      request<{ ok: boolean; id: string }>('POST', '/auth/register', { body }),
  },
  spaces: {
    list: (signal?: AbortSignal) => request<SpaceSummary[]>('GET', '/spaces', { signal }),
    create: (body: CreateSpaceRequest) => request<Space>('POST', '/spaces', { body }),
    tree: (slug: string, signal?: AbortSignal) =>
      request<PageTreeNode[]>('GET', `/spaces/${encodeURIComponent(slug)}/pages/tree`, { signal }),
    tags: {
      list: (slug: string, q?: string, signal?: AbortSignal) =>
        request<TagWithPageCount[]>(
          'GET',
          `/spaces/${encodeURIComponent(slug)}/tags${q ? `?q=${encodeURIComponent(q)}` : ''}`,
          { signal },
        ),
      pages: (slug: string, tagName: string, signal?: AbortSignal) =>
        request<TaggedPage[]>(
          'GET',
          `/spaces/${encodeURIComponent(slug)}/tags/${encodeURIComponent(tagName)}/pages`,
          { signal },
        ),
    },
  },
  pages: {
    get: (id: string, signal?: AbortSignal) =>
      request<PageWithRelations>('GET', `/pages/${encodeURIComponent(id)}`, { signal }),
    create: (spaceSlug: string, body: CreatePageRequest) =>
      request<Page>('POST', `/spaces/${encodeURIComponent(spaceSlug)}/pages`, { body }),
    update: (id: string, body: UpdatePageRequest) =>
      request<Page>('PATCH', `/pages/${encodeURIComponent(id)}`, { body }),
    attachments: (id: string, signal?: AbortSignal) =>
      request<Attachment[]>('GET', `/pages/${encodeURIComponent(id)}/attachments`, { signal }),
    tags: {
      list: (id: string, signal?: AbortSignal) =>
        request<PageTagStub[]>('GET', `/pages/${encodeURIComponent(id)}/tags`, { signal }),
      add: (id: string, body: AddTagRequest) =>
        request<PageTagStub>('POST', `/pages/${encodeURIComponent(id)}/tags`, { body }),
      remove: (id: string, tagName: string) =>
        request<void>('DELETE', `/pages/${encodeURIComponent(id)}/tags/${encodeURIComponent(tagName)}`),
    },
  },
  attachments: {
    uploadStandard: (pageId: string, file: File, signal?: AbortSignal) => {
      const fd = new FormData();
      fd.append('file', file, file.name);
      return request<Attachment>('POST', `/pages/${encodeURIComponent(pageId)}/attachments`, {
        rawBody: fd,
        headers: {
          'Content-Length': String(file.size),
        },
        signal,
      });
    },
    uploadLarge: (pageId: string, file: File, signal?: AbortSignal) => {
      const fd = new FormData();
      fd.append('file', file, file.name);
      return request<Attachment>('POST', `/pages/${encodeURIComponent(pageId)}/attachments/large`, {
        rawBody: fd,
        headers: {
          'Content-Length': String(file.size),
        },
        signal,
      });
    },
    downloadUrl: (id: string) => `/api/attachments/${encodeURIComponent(id)}/download`,
  },
};
