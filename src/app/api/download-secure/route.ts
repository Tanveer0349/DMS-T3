import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { eq, and } from "drizzle-orm";

import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import { documentVersions, documents, folders, accessControl } from "~/server/db/schema";
import { generateSignedUrl } from "~/lib/cloudinary";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized - Please log in" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const versionId = searchParams.get("versionId");
    const inline = searchParams.get("inline") === "true";

    if (!versionId) {
      return NextResponse.json({ error: "Version ID is required" }, { status: 400 });
    }

    // Get version with document and folder information
    const versionData = await db
      .select({
        version: documentVersions,
        document: documents,
        folder: folders,
      })
      .from(documentVersions)
      .innerJoin(documents, eq(documents.id, documentVersions.documentId))
      .innerJoin(folders, eq(folders.id, documents.folderId))
      .where(eq(documentVersions.id, versionId))
      .limit(1);

    if (versionData.length === 0) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const { version, document, folder } = versionData[0]!;

    // Check if user has access to this document
    if (session.user.role !== "system_admin") {
      // Check category access
      const hasAccess = await db
        .select()
        .from(accessControl)
        .where(
          and(
            eq(accessControl.userId, session.user.id),
            eq(accessControl.categoryId, folder.categoryId)
          )
        );

      if (hasAccess.length === 0) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      // If it's a personal folder, make sure user owns it
      if (folder.isPersonal && folder.createdBy !== session.user.id) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    // Generate signed URL from Cloudinary
    let fileUrl: string;
    
    if (version.cloudinaryPublicId) {
      // Use public ID to generate signed URL
      try {
        fileUrl = generateSignedUrl(version.cloudinaryPublicId, {
          expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
        });
      } catch (error) {
        console.error("Failed to generate signed URL:", error);
        // Fallback to direct URL
        fileUrl = version.fileUrl;
      }
    } else {
      // Fallback to direct URL for older documents
      fileUrl = version.fileUrl;
    }

    console.log(`[SecureDownload] User: ${session.user.email}, Document: ${document.name}, Version: ${version.versionNumber}, Inline: ${inline}`);

    // Fetch the file
    const response = await fetch(fileUrl, {
      method: 'GET',
      headers: {
        'Accept': '*/*',
        'User-Agent': 'DMS-SecureDownload/1.0',
      },
    });

    if (!response.ok) {
      console.error(`[SecureDownload] Failed to fetch file: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `Failed to fetch file: ${response.statusText}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const buffer = await response.arrayBuffer();

    if (buffer.byteLength === 0) {
      return NextResponse.json(
        { error: "File is empty or could not be retrieved" },
        { status: 500 }
      );
    }

    // Determine file extension from document name or content type
    let fileExtension = '';
    if (document.name.includes('.')) {
      fileExtension = '.' + document.name.split('.').pop();
    } else if (contentType.includes('pdf')) {
      fileExtension = '.pdf';
    } else if (contentType.includes('word') || contentType.includes('document')) {
      fileExtension = '.docx';
    } else if (contentType.includes('text')) {
      fileExtension = '.txt';
    } else if (contentType.includes('spreadsheet') || contentType.includes('excel')) {
      fileExtension = '.xlsx';
    }

    // Determine content disposition
    let contentDisposition: string;
    if (inline && contentType === 'application/pdf') {
      contentDisposition = `inline; filename="${encodeURIComponent(document.name)}_v${version.versionNumber}${fileExtension}"`;
    } else {
      contentDisposition = `attachment; filename="${encodeURIComponent(document.name)}_v${version.versionNumber}${fileExtension}"`;
    }

    console.log(`[SecureDownload] Success: ${document.name}, Size: ${buffer.byteLength} bytes, ContentType: ${contentType}`);

    // Return the file with proper headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': buffer.byteLength.toString(),
        'Content-Disposition': contentDisposition,
        'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error("[SecureDownload] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to download file" },
      { status: 500 }
    );
  }
}
