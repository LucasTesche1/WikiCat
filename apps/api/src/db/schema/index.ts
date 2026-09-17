import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  jsonb,
  boolean,
  integer,
  uniqueIndex,
  index,
  primaryKey,
  foreignKey,
  customType,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const tsvector = customType<{ data: string; driverData: string; default: true }>({
  dataType() {
    return 'tsvector';
  },
});

export const userRoleEnum = ['admin', 'editor', 'viewer'] as const;
export type UserRole = (typeof userRoleEnum)[number];

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: text('role', { enum: userRoleEnum }).notNull().default('viewer'),
    themePreference: text('theme_preference', { enum: ['system', 'light', 'dark'] })
      .notNull()
      .default('system'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    usersEmailUnq: uniqueIndex('users_email_unq').on(t.email),
    usersRoleIdx: index('users_role_idx').on(t.role),
  }),
);

export const spaces = pgTable(
  'spaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 120 }).notNull(),
    slug: varchar('slug', { length: 120 }).notNull(),
    description: text('description'),
    color: varchar('color', { length: 7 }).notNull().default('#6366f1'),
    icon: varchar('icon', { length: 32 }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    spacesSlugUnq: uniqueIndex('spaces_slug_unq').on(t.slug),
    spacesCreatedByIdx: index('spaces_created_by_idx').on(t.createdBy),
  }),
);

export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 64 }).notNull(),
    color: varchar('color', { length: 7 }).notNull().default('#6366f1'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    tagsSpaceNameUnq: uniqueIndex('tags_space_name_unq').on(t.spaceId, sql`lower(name)`),
    tagsSpaceIdx: index('tags_space_idx').on(t.spaceId),
  }),
);

export const pages = pgTable(
  'pages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id),
    parentPageId: uuid('parent_page_id').references((): AnyPgColumn => pages.id, {
      onDelete: 'set null',
    }),
    title: varchar('title', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    contentMarkdown: text('content_markdown').notNull().default(''),
    draftMarkdown: text('draft_markdown'),
    isDraft: boolean('is_draft').notNull().default(false),
    orderIndex: integer('order_index').notNull().default(0),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    updatedBy: uuid('updated_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ftsVector: tsvector('fts_vector'),
    tagNamesDenorm: text('tag_names_denorm').notNull().default(''),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
  },
  (t) => ({
    pagesSpaceSlugUnq: uniqueIndex('pages_space_slug_unq').on(t.spaceId, t.slug),
    pagesParentIdx: index('pages_parent_idx').on(t.parentPageId),
    pagesFtsGin: index('pages_fts_gin').using('gin', t.ftsVector),
    pagesTitleTrgmGin: index('pages_title_trgm_gin').using(
      'gin',
      sql`title gin_trgm_ops`,
    ),
  }),
);

export const pageTags = pgTable(
  'page_tags',
  {
    pageId: uuid('page_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.pageId, t.tagId] }),
  }),
);

export const pageVersions = pgTable(
  'page_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pageId: uuid('page_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    snapshotMarkdown: text('snapshot_markdown').notNull(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pageVersionUnq: uniqueIndex('page_versions_page_version_unq').on(t.pageId, t.versionNumber),
    pageVersionAuthorIdx: index('page_versions_author_idx').on(t.authorId),
  }),
);

export const documentTemplates = pgTable(
  'document_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: varchar('key', { length: 120 }).notNull(),
    title: varchar('title', { length: 160 }).notNull(),
    description: text('description'),
    contentMarkdown: text('content_markdown').notNull(),
    isSystem: boolean('is_system').notNull().default(false),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    documentTemplatesKeyUnq: uniqueIndex('document_templates_key_unq').on(t.key).where(sql`${t.deletedAt} IS NULL`),
    documentTemplatesTitleUnq: uniqueIndex('document_templates_title_unq').on(sql`lower(${t.title})`).where(sql`${t.deletedAt} IS NULL`),
  }),
);

export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pageId: uuid('page_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    originalName: varchar('original_name', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 120 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    storagePath: varchar('storage_path', { length: 500 }).notNull(),
    storageTier: text('storage_tier', { enum: ['standard', 'large'] }).notNull().default('standard'),
    uploadedBy: uuid('uploaded_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    attachmentsPageIdx: index('attachments_page_idx').on(t.pageId),
    attachmentsTierIdx: index('attachments_tier_idx').on(t.storageTier),
  }),
);

export const authTokens = pgTable('auth_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  tokenJti: varchar('token_jti', { length: 64 }).notNull(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
