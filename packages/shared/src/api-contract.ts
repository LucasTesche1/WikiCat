export type UserRole = 'admin' | 'editor' | 'viewer';
export type StorageTier = 'standard' | 'large';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  themePreference: 'system' | 'light' | 'dark';
  createdAt: Date;
  updatedAt: Date;
}

export interface Space {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  icon: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface SpaceSummary extends Space {
  pageCount: number;
}

export interface Tag {
  id: string;
  spaceId: string;
  name: string;
  color: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TagWithPageCount extends Pick<Tag, 'id' | 'spaceId' | 'name' | 'color' | 'createdAt'> {
  pageCount: number;
}

export interface PageTagStub extends Pick<Tag, 'id' | 'name' | 'color'> {}

export interface TaggedPage extends Pick<Page, 'id' | 'title' | 'slug' | 'parentPageId' | 'updatedAt'> {
  updatedByName: string;
  tags: PageTagStub[];
}

export interface Attachment {
  id: string;
  pageId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  storageTier: 'standard' | 'large';
  uploadedBy: string;
  createdAt: Date;
}

export interface Page {
  id: string;
  spaceId: string;
  parentPageId: string | null;
  title: string;
  slug: string;
  contentMarkdown: string;
  draftMarkdown: string | null;
  isDraft: boolean;
  orderIndex: number;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface PageWithRelations extends Page {
  tags: PageTagStub[];
  createdByUser: Pick<User, 'id' | 'name'>;
  updatedByUser: Pick<User, 'id' | 'name'>;
}

export interface PageTreeNode {
  id: string;
  title: string;
  slug: string;
  parentPageId: string | null;
  orderIndex: number;
  children: PageTreeNode[];
}

export interface PageVersion {
  id: string;
  pageId: string;
  versionNumber: number;
  snapshotMarkdown: string;
  authorId: string;
  authorName: string;
  createdAt: Date;
}

export interface VersionDiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNumberOld: number | null;
  lineNumberNew: number | null;
}

export interface VersionDiff {
  unified: string;
  lines: VersionDiffLine[];
  stats: { additions: number; deletions: number };
}

export interface SearchResultItem {
  pageId: string;
  title: string;
  spaceId: string;
  spaceName: string;
  breadcrumb: string[];
  snippet: string;
  tags: string[];
  updatedAt: Date;
  updatedByName: string;
  rank: number;
}

export interface SearchResponse {
  query: string;
  total: number;
  tookMs: number;
  results: SearchResultItem[];
}

export type AuthLoginRequest = {
  email: string;
  password: string;
};

export type AuthMeResponse = Pick<User, 'id' | 'email' | 'name' | 'role' | 'themePreference'>;

export type CreateUserRequest = {
  email: string;
  name: string;
  password: string;
  role: UserRole;
};

export type CreateSpaceRequest = {
  name: string;
  slug: string;
  description?: string | null;
  color?: string;
  icon?: string | null;
};

export type UpdateSpaceRequest = Partial<Omit<CreateSpaceRequest, 'slug'>> & {
  slug?: string;
};

export type CreatePageRequest = {
  title: string;
  parentPageId?: string | null;
  orderIndex?: number;
  contentMarkdown?: string;
};

export type UpdatePageRequest = {
  expectedUpdatedAt?: string;
  title?: string;
  parentPageId?: string | null;
  orderIndex?: number;
  contentMarkdown?: string;
  draftMarkdown?: string | null;
  isDraft?: boolean;
};

export type UpdatePasswordRequest = {
  currentPassword: string;
  newPassword: string;
};

export type UpdateProfileRequest = {
  name?: string;
  email?: string;
  themePreference?: 'system' | 'light' | 'dark';
};

export type AddTagRequest = {
  name: string;
  color?: string;
};

export type RestoreVersionRequest = {
  note?: string;
};

export type HealthStatus = {
  status: 'ok' | 'degraded' | 'unhealthy';
  db?: 'ok' | 'unhealthy';
  appVersion: string;
  timestamp: string;
};

export type WorkspaceSearchItem = {
  pageId: string; title: string; spaceSlug: string; spaceName: string;
  snippet: string; updatedAt: string; updatedByName: string;
  anchor?: string; sectionTitle?: string;
};
export type WorkspaceSearchResponse = { results: WorkspaceSearchItem[]; tookMs: number; hasMore: boolean };
export type DocumentVersion = {
  id: string; versionNumber: number; snapshotMarkdown: string;
  authorName: string; createdAt: string;
};
