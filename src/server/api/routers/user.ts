import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { generateId } from "~/lib/utils";
import {
  accessControl,
  categories,
  documents,
  documentVersions,
  folders,
  users,
} from "~/server/db/schema";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const userRouter = createTRPCRouter({
  // Get accessible categories for the user
  getAccessibleCategories: protectedProcedure.query(async ({ ctx }) => {
    // Get categories the user has access to
    const userAccess = await ctx.db
      .select({
        categoryId: accessControl.categoryId,
        accessLevel: accessControl.accessLevel,
        categoryName: categories.name,
        categoryCreatedBy: categories.createdBy,
        categoryCreatedAt: categories.createdAt,
      })
      .from(accessControl)
      .innerJoin(categories, eq(categories.id, accessControl.categoryId))
      .where(eq(accessControl.userId, ctx.session.user.id));

    return userAccess.map((access) => ({
      id: access.categoryId,
      name: access.categoryName,
      createdBy: access.categoryCreatedBy,
      createdAt: access.categoryCreatedAt,
      accessLevel: access.accessLevel,
    }));
  }),

  // Get folders in accessible categories
  getFoldersByCategory: protectedProcedure
    .input(z.object({ categoryId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Check if user has access to this category
      const hasAccess = await ctx.db
        .select()
        .from(accessControl)
        .where(
          and(
            eq(accessControl.userId, ctx.session.user.id),
            eq(accessControl.categoryId, input.categoryId)
          )
        );

      if (hasAccess.length === 0) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Get all folders in category (both personal and shared)
      const allFolders = await ctx.db
        .select()
        .from(folders)
        .where(eq(folders.categoryId, input.categoryId));

      // Filter to show only:
      // 1. Non-personal folders (shared)
      // 2. Personal folders created by this user
      return allFolders.filter(
        (folder) =>
          !folder.isPersonal || folder.createdBy === ctx.session.user.id
      );
    }),

  // Get documents in accessible folders
  getDocumentsByFolder: protectedProcedure
    .input(z.object({ folderId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Check folder access
      const folderData = await ctx.db
        .select()
        .from(folders)
        .where(eq(folders.id, input.folderId))
        .limit(1);

      if (folderData.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const folder = folderData[0]!;

      // Check if user has access to the category
      const hasAccess = await ctx.db
        .select()
        .from(accessControl)
        .where(
          and(
            eq(accessControl.userId, ctx.session.user.id),
            eq(accessControl.categoryId, folder.categoryId)
          )
        );

      if (hasAccess.length === 0) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // If it's a personal folder, make sure the user owns it
      if (folder.isPersonal && folder.createdBy !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.db
        .select()
        .from(documents)
        .where(eq(documents.folderId, input.folderId));
    }),

  // Create personal folder
  createPersonalFolder: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        categoryId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user has access to this category
      const hasAccess = await ctx.db
        .select()
        .from(accessControl)
        .where(
          and(
            eq(accessControl.userId, ctx.session.user.id),
            eq(accessControl.categoryId, input.categoryId)
          )
        );

      if (hasAccess.length === 0) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const id = generateId();
      await ctx.db.insert(folders).values({
        id,
        name: input.name,
        categoryId: input.categoryId,
        createdBy: ctx.session.user.id,
        isPersonal: true,
      });

      return { id, name: input.name };
    }),

  // Update personal folder
  updatePersonalFolder: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // Check if user owns this folder
      const folder = await ctx.db
        .select()
        .from(folders)
        .where(
          and(
            eq(folders.id, input.id),
            eq(folders.createdBy, ctx.session.user.id),
            eq(folders.isPersonal, true)
          )
        );

      if (folder.length === 0) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await ctx.db
        .update(folders)
        .set({ name: input.name })
        .where(eq(folders.id, input.id));

      return { success: true };
    }),

  // Delete personal folder
  deletePersonalFolder: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check if user owns this folder
      const folder = await ctx.db
        .select()
        .from(folders)
        .where(
          and(
            eq(folders.id, input.id),
            eq(folders.createdBy, ctx.session.user.id),
            eq(folders.isPersonal, true)
          )
        );

      if (folder.length === 0) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await ctx.db.delete(folders).where(eq(folders.id, input.id));
      return { success: true };
    }),

  // Create document
  createDocument: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        folderId: z.string(),
        cloudinaryUrl: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check folder access
      const folder = await ctx.db
        .select()
        .from(folders)
        .where(eq(folders.id, input.folderId))
        .limit(1);

      if (folder.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Check category access
      const hasAccess = await ctx.db
        .select()
        .from(accessControl)
        .where(
          and(
            eq(accessControl.userId, ctx.session.user.id),
            eq(accessControl.categoryId, folder[0]!.categoryId)
          )
        );

      if (hasAccess.length === 0) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // If it's a personal folder, make sure user owns it
      if (folder[0]!.isPersonal && folder[0]!.createdBy !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // For shared folders, check if user has full access
      if (!folder[0]!.isPersonal && hasAccess[0]?.accessLevel !== "full") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const documentId = generateId();
      const versionId = generateId();

      // Create document
      await ctx.db.insert(documents).values({
        id: documentId,
        name: input.name,
        folderId: input.folderId,
        createdBy: ctx.session.user.id,
        cloudinaryUrl: input.cloudinaryUrl,
        currentVersionId: versionId,
      });

      // Create first version
      await ctx.db.insert(documentVersions).values({
        id: versionId,
        documentId,
        versionNumber: 1,
        fileUrl: input.cloudinaryUrl,
        uploadedBy: ctx.session.user.id,
      });

      return { id: documentId, name: input.name };
    }),

  // Create document version
  createDocumentVersion: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        fileUrl: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user can upload versions for this document
      const documentData = await ctx.db
        .select({
          document: documents,
          folder: folders,
        })
        .from(documents)
        .innerJoin(folders, eq(folders.id, documents.folderId))
        .where(eq(documents.id, input.documentId))
        .limit(1);

      if (documentData.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const doc = documentData[0]!;

      // Check category access
      const hasAccess = await ctx.db
        .select()
        .from(accessControl)
        .where(
          and(
            eq(accessControl.userId, ctx.session.user.id),
            eq(accessControl.categoryId, doc.folder.categoryId)
          )
        );

      if (hasAccess.length === 0) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Users can upload versions if:
      // 1. They own the document, OR
      // 2. It's in a shared folder and they have full access
      const canUpload =
        doc.document.createdBy === ctx.session.user.id ||
        (!doc.folder.isPersonal && hasAccess[0]?.accessLevel === "full");

      if (!canUpload) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Get current max version number
      const existingVersions = await ctx.db
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.documentId, input.documentId));

      const maxVersion = Math.max(
        ...existingVersions.map((v) => v.versionNumber),
        0
      );

      const versionId = generateId();
      const newVersionNumber = maxVersion + 1;

      // Create new version
      await ctx.db.insert(documentVersions).values({
        id: versionId,
        documentId: input.documentId,
        versionNumber: newVersionNumber,
        fileUrl: input.fileUrl,
        uploadedBy: ctx.session.user.id,
      });

      // Update document's current version
      await ctx.db
        .update(documents)
        .set({ 
          currentVersionId: versionId,
          cloudinaryUrl: input.fileUrl 
        })
        .where(eq(documents.id, input.documentId));

      return { id: versionId, versionNumber: newVersionNumber };
    }),

  // Delete document (only if user owns it or has full access to shared folder)
  deleteDocument: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check document ownership and permissions
      const documentData = await ctx.db
        .select({
          document: documents,
          folder: folders,
        })
        .from(documents)
        .innerJoin(folders, eq(folders.id, documents.folderId))
        .where(eq(documents.id, input.id))
        .limit(1);

      if (documentData.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const doc = documentData[0]!;

      // Check category access
      const hasAccess = await ctx.db
        .select()
        .from(accessControl)
        .where(
          and(
            eq(accessControl.userId, ctx.session.user.id),
            eq(accessControl.categoryId, doc.folder.categoryId)
          )
        );

      if (hasAccess.length === 0) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Users can delete documents if:
      // 1. They own the document, OR
      // 2. It's in a shared folder and they have full access
      const canDelete =
        doc.document.createdBy === ctx.session.user.id ||
        (!doc.folder.isPersonal && hasAccess[0]?.accessLevel === "full");

      if (!canDelete) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await ctx.db.delete(documents).where(eq(documents.id, input.id));
      return { success: true };
    }),

  deleteDocumentVersion: protectedProcedure
    .input(z.object({ versionId: z.string(), documentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check document access and permissions
      const documentData = await ctx.db
        .select({
          document: documents,
          folder: folders,
        })
        .from(documents)
        .innerJoin(folders, eq(folders.id, documents.folderId))
        .where(eq(documents.id, input.documentId))
        .limit(1);

      if (documentData.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const doc = documentData[0]!;

      // Check category access
      const hasAccess = await ctx.db
        .select()
        .from(accessControl)
        .where(
          and(
            eq(accessControl.userId, ctx.session.user.id),
            eq(accessControl.categoryId, doc.folder.categoryId)
          )
        );

      if (hasAccess.length === 0) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Users can delete versions if:
      // 1. They own the document, OR
      // 2. It's in a shared folder and they have full access
      const canDelete =
        doc.document.createdBy === ctx.session.user.id ||
        (!doc.folder.isPersonal && hasAccess[0]?.accessLevel === "full");

      if (!canDelete) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Get the version to delete
      const versionToDelete = await ctx.db
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.id, input.versionId))
        .limit(1);

      if (versionToDelete.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Version not found" });
      }

      // Check if this is the only version
      const allVersions = await ctx.db
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.documentId, input.documentId));

      if (allVersions.length === 1) {
        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: "Cannot delete the only version of a document" 
        });
      }

      // Delete the version
      await ctx.db
        .delete(documentVersions)
        .where(eq(documentVersions.id, input.versionId));

      // If this was the current version, update to the latest remaining version
      if (doc.document.currentVersionId === input.versionId) {
        const remainingVersions = await ctx.db
          .select()
          .from(documentVersions)
          .where(eq(documentVersions.documentId, input.documentId))
          .orderBy(documentVersions.versionNumber);

        if (remainingVersions.length > 0) {
          const latestVersion = remainingVersions[remainingVersions.length - 1]!;
          await ctx.db
            .update(documents)
            .set({ 
              currentVersionId: latestVersion.id,
              cloudinaryUrl: latestVersion.fileUrl 
            })
            .where(eq(documents.id, input.documentId));
        }
      }

      return { success: true };
    }),

  // Get document versions
  getDocumentVersions: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Check document access first
      const documentData = await ctx.db
        .select({
          document: documents,
          folder: folders,
        })
        .from(documents)
        .innerJoin(folders, eq(folders.id, documents.folderId))
        .where(eq(documents.id, input.documentId))
        .limit(1);

      if (documentData.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const doc = documentData[0]!;

      // Check category access
      const hasAccess = await ctx.db
        .select()
        .from(accessControl)
        .where(
          and(
            eq(accessControl.userId, ctx.session.user.id),
            eq(accessControl.categoryId, doc.folder.categoryId)
          )
        );

      if (hasAccess.length === 0) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.db
        .select({
          id: documentVersions.id,
          documentId: documentVersions.documentId,
          versionNumber: documentVersions.versionNumber,
          fileUrl: documentVersions.fileUrl,
          uploadedBy: users.name,
          uploadedByEmail: users.email,
          createdAt: documentVersions.createdAt,
        })
        .from(documentVersions)
        .innerJoin(users, eq(users.id, documentVersions.uploadedBy))
        .where(eq(documentVersions.documentId, input.documentId))
        .orderBy(documentVersions.versionNumber);
    }),
});