import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTableCreator,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import type { AdapterAccount } from "next-auth/adapters";

export const createTable = pgTableCreator((name) => `dms_${name}`);

// Enums
export const roleEnum = pgEnum("role", ["system_admin", "user"]);
export const accessLevelEnum = pgEnum("access_level", ["full", "read"]);

// NextAuth tables
export const users = createTable("user", {
  id: varchar("id", { length: 255 }).notNull().primaryKey(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: timestamp("emailVerified", {
    mode: "date",
  }),
  image: varchar("image", { length: 255 }),
  role: roleEnum("role").notNull().default("user"),
  passwordHash: varchar("password_hash", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const accounts = createTable(
  "account",
  {
    userId: varchar("userId", { length: 255 })
      .notNull()
      .references(() => users.id),
    type: varchar("type", { length: 255 })
      .$type<AdapterAccount["type"]>()
      .notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("providerAccountId", {
      length: 255,
    }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
    userIdIdx: index("account_userId_idx").on(account.userId),
  })
);

export const sessions = createTable(
  "session",
  {
    sessionToken: varchar("sessionToken", { length: 255 })
      .notNull()
      .primaryKey(),
    userId: varchar("userId", { length: 255 })
      .notNull()
      .references(() => users.id),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (session) => ({
    userIdIdx: index("session_userId_idx").on(session.userId),
  })
);

export const verificationTokens = createTable(
  "verificationToken",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

// DMS Tables
export const categories = createTable(
  "category",
  {
    id: varchar("id", { length: 255 }).notNull().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    createdBy: varchar("created_by", { length: 255 })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (category) => ({
    createdByIdx: index("category_created_by_idx").on(category.createdBy),
  })
);

export const folders = createTable(
  "folder",
  {
    id: varchar("id", { length: 255 }).notNull().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    categoryId: varchar("category_id", { length: 255 })
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    createdBy: varchar("created_by", { length: 255 })
      .notNull()
      .references(() => users.id),
    isPersonal: boolean("is_personal").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (folder) => ({
    categoryIdIdx: index("folder_category_id_idx").on(folder.categoryId),
    createdByIdx: index("folder_created_by_idx").on(folder.createdBy),
  })
);

export const documents = createTable(
  "document",
  {
    id: varchar("id", { length: 255 }).notNull().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    folderId: varchar("folder_id", { length: 255 })
      .notNull()
      .references(() => folders.id, { onDelete: "cascade" }),
    createdBy: varchar("created_by", { length: 255 })
      .notNull()
      .references(() => users.id),
    cloudinaryUrl: text("cloudinary_url").notNull(),
    cloudinaryPublicId: text("cloudinary_public_id"),
    currentVersionId: varchar("current_version_id", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (document) => ({
    folderIdIdx: index("document_folder_id_idx").on(document.folderId),
    createdByIdx: index("document_created_by_idx").on(document.createdBy),
  })
);

export const documentVersions = createTable(
  "document_version",
  {
    id: varchar("id", { length: 255 }).notNull().primaryKey(),
    documentId: varchar("document_id", { length: 255 })
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    fileUrl: text("file_url").notNull(),
    cloudinaryPublicId: text("cloudinary_public_id"),
    uploadedBy: varchar("uploaded_by", { length: 255 })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (version) => ({
    documentIdIdx: index("document_version_document_id_idx").on(version.documentId),
    uploadedByIdx: index("document_version_uploaded_by_idx").on(version.uploadedBy),
  })
);

export const accessControl = createTable(
  "access_control",
  {
    id: varchar("id", { length: 255 }).notNull().primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: varchar("category_id", { length: 255 })
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    accessLevel: accessLevelEnum("access_level").notNull(),
    grantedBy: varchar("granted_by", { length: 255 })
      .notNull()
      .references(() => users.id),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (access) => ({
    userIdIdx: index("access_control_user_id_idx").on(access.userId),
    categoryIdIdx: index("access_control_category_id_idx").on(access.categoryId),
    compoundKey: index("access_control_user_category_idx").on(
      access.userId,
      access.categoryId
    ),
  })
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  createdCategories: many(categories),
  createdFolders: many(folders),
  createdDocuments: many(documents),
  uploadedVersions: many(documentVersions),
  accessControls: many(accessControl),
  grantedAccess: many(accessControl, { relationName: "GrantedAccess" }),
  documentComments: many(documentComments),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [categories.createdBy],
    references: [users.id],
  }),
  folders: many(folders),
  accessControls: many(accessControl),
}));

export const foldersRelations = relations(folders, ({ one, many }) => ({
  category: one(categories, {
    fields: [folders.categoryId],
    references: [categories.id],
  }),
  createdBy: one(users, {
    fields: [folders.createdBy],
    references: [users.id],
  }),
  documents: many(documents),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  folder: one(folders, {
    fields: [documents.folderId],
    references: [folders.id],
  }),
  createdBy: one(users, {
    fields: [documents.createdBy],
    references: [users.id],
  }),
  currentVersion: one(documentVersions, {
    fields: [documents.currentVersionId],
    references: [documentVersions.id],
  }),
  versions: many(documentVersions),
  comments: many(documentComments),
}));

export const documentVersionsRelations = relations(
  documentVersions,
  ({ one }) => ({
    document: one(documents, {
      fields: [documentVersions.documentId],
      references: [documents.id],
    }),
    uploadedBy: one(users, {
      fields: [documentVersions.uploadedBy],
      references: [users.id],
    }),
  })
);

export const accessControlRelations = relations(accessControl, ({ one }) => ({
  user: one(users, {
    fields: [accessControl.userId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [accessControl.categoryId],
    references: [categories.id],
  }),
  grantedBy: one(users, {
    fields: [accessControl.grantedBy],
    references: [users.id],
    relationName: "GrantedAccess",
  }),
}));

// Document Comments Table
export const documentComments = createTable(
  "document_comment",
  {
    id: varchar("id", { length: 255 }).notNull().primaryKey(),
    documentId: varchar("document_id", { length: 255 })
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    parentCommentId: varchar("parent_comment_id", { length: 255 }),
    content: text("content").notNull(),
    authorId: varchar("author_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    isEdited: boolean("is_edited").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (comment) => ({
    documentIdIdx: index("document_comment_document_id_idx").on(comment.documentId),
    authorIdIdx: index("document_comment_author_id_idx").on(comment.authorId),
    parentCommentIdIdx: index("document_comment_parent_id_idx").on(comment.parentCommentId),
  })
);

// Document Comments Relations
export const documentCommentsRelations = relations(
  documentComments,
  ({ one, many }) => ({
    document: one(documents, {
      fields: [documentComments.documentId],
      references: [documents.id],
    }),
    author: one(users, {
      fields: [documentComments.authorId],
      references: [users.id],
    }),
    parentComment: one(documentComments, {
      fields: [documentComments.parentCommentId],
      references: [documentComments.id],
      relationName: "ParentComment",
    }),
    replies: many(documentComments, {
      relationName: "ParentComment",
    }),
  })
);