import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { generateId } from "~/lib/utils";
import {
  accessControl,
  categories,
  documents,
  documentVersions,
  documentComments,
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

      // Users can only upload to their own personal folders
      if (!folder[0]!.isPersonal || folder[0]!.createdBy !== ctx.session.user.id) {
        throw new TRPCError({ 
          code: "FORBIDDEN", 
          message: "You can only upload documents to your personal folders. Use clone feature for shared documents." 
        });
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

      // Users can only upload versions to documents they own in personal folders
      const canUpload = 
        doc.document.createdBy === ctx.session.user.id && 
        doc.folder.isPersonal;

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

      // Users can only delete documents they own in personal folders
      const canDelete = 
        doc.document.createdBy === ctx.session.user.id && 
        doc.folder.isPersonal;

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

      // Users can only delete versions of documents they own in personal folders
      const canDelete = 
        doc.document.createdBy === ctx.session.user.id && 
        doc.folder.isPersonal;

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

  // Document Comments
  getDocumentComments: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .query(async ({ ctx, input }) => {
      // First check if user has access to this document
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

      // If it's a personal folder, make sure user owns it
      if (doc.folder.isPersonal && doc.folder.createdBy !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.db
        .select({
          id: documentComments.id,
          documentId: documentComments.documentId,
          parentCommentId: documentComments.parentCommentId,
          content: documentComments.content,
          authorId: documentComments.authorId,
          authorName: users.name,
          authorEmail: users.email,
          isEdited: documentComments.isEdited,
          createdAt: documentComments.createdAt,
          updatedAt: documentComments.updatedAt,
        })
        .from(documentComments)
        .innerJoin(users, eq(users.id, documentComments.authorId))
        .where(eq(documentComments.documentId, input.documentId))
        .orderBy(documentComments.createdAt);
    }),

  createComment: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        content: z.string().min(1),
        parentCommentId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check document access
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

      // If it's a personal folder, make sure user owns it
      if (doc.folder.isPersonal && doc.folder.createdBy !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const commentId = generateId();
      
      await ctx.db.insert(documentComments).values({
        id: commentId,
        documentId: input.documentId,
        parentCommentId: input.parentCommentId || null,
        content: input.content,
        authorId: ctx.session.user.id,
      });

      return { id: commentId, content: input.content };
    }),

  updateComment: protectedProcedure
    .input(
      z.object({
        commentId: z.string(),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user owns the comment
      const comment = await ctx.db
        .select()
        .from(documentComments)
        .where(
          and(
            eq(documentComments.id, input.commentId),
            eq(documentComments.authorId, ctx.session.user.id)
          )
        )
        .limit(1);

      if (comment.length === 0) {
        throw new TRPCError({ 
          code: "FORBIDDEN", 
          message: "You can only edit your own comments" 
        });
      }

      await ctx.db
        .update(documentComments)
        .set({ 
          content: input.content,
          isEdited: true,
          updatedAt: new Date(),
        })
        .where(eq(documentComments.id, input.commentId));

      return { success: true };
    }),

  deleteComment: protectedProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check if user owns the comment
      const comment = await ctx.db
        .select()
        .from(documentComments)
        .where(
          and(
            eq(documentComments.id, input.commentId),
            eq(documentComments.authorId, ctx.session.user.id)
          )
        )
        .limit(1);

      if (comment.length === 0) {
        throw new TRPCError({ 
          code: "FORBIDDEN", 
          message: "You can only delete your own comments" 
        });
      }

      await ctx.db
        .delete(documentComments)
        .where(eq(documentComments.id, input.commentId));
      
      return { success: true };
    }),

  // Clone Document
  cloneDocument: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        targetFolderId: z.string(),
        newName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // First, verify user has access to the source document
      const sourceDocumentData = await ctx.db
        .select({
          document: documents,
          folder: folders,
        })
        .from(documents)
        .innerJoin(folders, eq(folders.id, documents.folderId))
        .where(eq(documents.id, input.documentId))
        .limit(1);

      if (sourceDocumentData.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Source document not found" });
      }

      const sourceDoc = sourceDocumentData[0]!;

      // Check if user has access to the source document's category
      const hasSourceAccess = await ctx.db
        .select()
        .from(accessControl)
        .where(
          and(
            eq(accessControl.userId, ctx.session.user.id),
            eq(accessControl.categoryId, sourceDoc.folder.categoryId)
          )
        );

      if (hasSourceAccess.length === 0) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No access to source document" });
      }

      // Verify target folder exists and user owns it (must be personal folder)
      const targetFolder = await ctx.db
        .select()
        .from(folders)
        .where(
          and(
            eq(folders.id, input.targetFolderId),
            eq(folders.createdBy, ctx.session.user.id),
            eq(folders.isPersonal, true)
          )
        )
        .limit(1);

      if (targetFolder.length === 0) {
        throw new TRPCError({ 
          code: "FORBIDDEN", 
          message: "Target folder must be your personal folder" 
        });
      }

      // Check if user has access to target folder's category
      const hasTargetAccess = await ctx.db
        .select()
        .from(accessControl)
        .where(
          and(
            eq(accessControl.userId, ctx.session.user.id),
            eq(accessControl.categoryId, targetFolder[0]!.categoryId)
          )
        );

      if (hasTargetAccess.length === 0) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No access to target category" });
      }

      // Get the current version of the source document
      const currentVersion = await ctx.db
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.id, sourceDoc.document.currentVersionId!))
        .limit(1);

      if (currentVersion.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Source document version not found" });
      }

      const clonedDocumentId = generateId();
      const clonedVersionId = generateId();
      const documentName = input.newName || `${sourceDoc.document.name} (Copy)`;

      // Create the cloned document
      await ctx.db.insert(documents).values({
        id: clonedDocumentId,
        name: documentName,
        folderId: input.targetFolderId,
        createdBy: ctx.session.user.id,
        cloudinaryUrl: currentVersion[0]!.fileUrl, // Use same file URL
        currentVersionId: clonedVersionId,
      });

      // Create the first version for cloned document
      await ctx.db.insert(documentVersions).values({
        id: clonedVersionId,
        documentId: clonedDocumentId,
        versionNumber: 1,
        fileUrl: currentVersion[0]!.fileUrl, // Use same file URL
        uploadedBy: ctx.session.user.id,
      });

      return { 
        id: clonedDocumentId, 
        name: documentName,
        message: "Document cloned successfully" 
      };
    }),

  // Get user's personal folders for cloning
  getPersonalFoldersForCloning: protectedProcedure.query(async ({ ctx }) => {
    // Get all categories user has access to
    const userAccess = await ctx.db
      .select({
        categoryId: accessControl.categoryId,
        categoryName: categories.name,
      })
      .from(accessControl)
      .innerJoin(categories, eq(categories.id, accessControl.categoryId))
      .where(eq(accessControl.userId, ctx.session.user.id));

    if (userAccess.length === 0) {
      return [];
    }

    const categoryIds = userAccess.map(access => access.categoryId);

    // Get user's personal folders in accessible categories
    const personalFolders = await ctx.db
      .select({
        id: folders.id,
        name: folders.name,
        categoryId: folders.categoryId,
        categoryName: categories.name,
        createdAt: folders.createdAt,
      })
      .from(folders)
      .innerJoin(categories, eq(categories.id, folders.categoryId))
      .where(
        and(
          eq(folders.createdBy, ctx.session.user.id),
          eq(folders.isPersonal, true),
          inArray(folders.categoryId, categoryIds)
        )
      )
      .orderBy(categories.name, folders.name);

    return personalFolders;
  }),
});