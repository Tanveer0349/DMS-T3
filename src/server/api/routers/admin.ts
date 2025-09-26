import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
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
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";

export const adminRouter = createTRPCRouter({
  // Users
  getAllUsers: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users);
  }),

  createUser: adminProcedure
    .input(z.object({ 
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(6),
      role: z.enum(["system_admin", "user"]).default("user")
    }))
    .mutation(async ({ ctx, input }) => {
      const bcrypt = await import("bcryptjs");
      const passwordHash = await bcrypt.hash(input.password, 10);
      
      const userId = generateId();
      
      try {
        await ctx.db.insert(users).values({
          id: userId,
          name: input.name,
          email: input.email,
          passwordHash,
          role: input.role,
        });

        return { 
          id: userId, 
          name: input.name, 
          email: input.email, 
          role: input.role 
        };
      } catch (error) {
        throw new TRPCError({ 
          code: "CONFLICT", 
          message: "User with this email already exists" 
        });
      }
    }),

  deleteUser: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Prevent admin from deleting themselves
      if (input.id === ctx.session.user.id) {
        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: "Cannot delete your own account" 
        });
      }

      await ctx.db.delete(users).where(eq(users.id, input.id));
      return { success: true };
    }),
  // Categories
  createCategory: adminProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const id = generateId();
      await ctx.db.insert(categories).values({
        id,
        name: input.name,
        createdBy: ctx.session.user.id,
      });
      return { id, name: input.name };
    }),

  getCategories: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(categories);
  }),

  updateCategory: adminProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(categories)
        .set({ name: input.name })
        .where(eq(categories.id, input.id));
      return { success: true };
    }),

  deleteCategory: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(categories).where(eq(categories.id, input.id));
      return { success: true };
    }),

  // Folders
  createFolder: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        categoryId: z.string(),
        isPersonal: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = generateId();
      await ctx.db.insert(folders).values({
        id,
        name: input.name,
        categoryId: input.categoryId,
        createdBy: ctx.session.user.id,
        isPersonal: input.isPersonal,
      });
      return { id, name: input.name };
    }),

  getFoldersByCategory: adminProcedure
    .input(z.object({ categoryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(folders)
        .where(eq(folders.categoryId, input.categoryId));
    }),

  updateFolder: adminProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(folders)
        .set({ name: input.name })
        .where(eq(folders.id, input.id));
      return { success: true };
    }),

  deleteFolder: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(folders).where(eq(folders.id, input.id));
      return { success: true };
    }),

  // Documents
  createDocument: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        folderId: z.string(),
        cloudinaryUrl: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
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

  getDocumentsByFolder: adminProcedure
    .input(z.object({ folderId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(documents)
        .where(eq(documents.folderId, input.folderId));
    }),

  updateDocument: adminProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(documents)
        .set({ name: input.name })
        .where(eq(documents.id, input.id));
      return { success: true };
    }),

  deleteDocument: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(documents).where(eq(documents.id, input.id));
      return { success: true };
    }),

  // Document Versions
  createDocumentVersion: adminProcedure
    .input(
      z.object({
        documentId: z.string(),
        fileUrl: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
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

  deleteDocumentVersion: adminProcedure
    .input(z.object({ versionId: z.string(), documentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
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
      const document = await ctx.db
        .select()
        .from(documents)
        .where(eq(documents.id, input.documentId))
        .limit(1);

      if (document.length > 0 && document[0]!.currentVersionId === input.versionId) {
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

  getDocumentVersions: adminProcedure
    .input(z.object({ documentId: z.string() }))
    .query(async ({ ctx, input }) => {
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

  // Access Control
  grantAccess: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        categoryId: z.string(),
        accessLevel: z.enum(["full", "read"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if access already exists
      const existing = await ctx.db
        .select()
        .from(accessControl)
        .where(
          and(
            eq(accessControl.userId, input.userId),
            eq(accessControl.categoryId, input.categoryId)
          )
        );

      if (existing.length > 0) {
        // Update existing access
        await ctx.db
          .update(accessControl)
          .set({ accessLevel: input.accessLevel })
          .where(eq(accessControl.id, existing[0]!.id));
      } else {
        // Create new access
        await ctx.db.insert(accessControl).values({
          id: generateId(),
          userId: input.userId,
          categoryId: input.categoryId,
          accessLevel: input.accessLevel,
          grantedBy: ctx.session.user.id,
        });
      }

      return { success: true };
    }),

  revokeAccess: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        categoryId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(accessControl)
        .where(
          and(
            eq(accessControl.userId, input.userId),
            eq(accessControl.categoryId, input.categoryId)
          )
        );
      return { success: true };
    }),

  getCategoryAccess: adminProcedure
    .input(z.object({ categoryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: accessControl.id,
          userId: accessControl.userId,
          accessLevel: accessControl.accessLevel,
          grantedAt: accessControl.grantedAt,
        })
        .from(accessControl)
        .where(eq(accessControl.categoryId, input.categoryId));
    }),
});