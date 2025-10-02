import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { eq, and } from "drizzle-orm";

import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import { documentVersions, documents, folders, accessControl } from "~/server/db/schema";
import { generateSignedUrl } from "~/lib/cloudinary";

function processSuccessfulResponse(buffer: ArrayBuffer, contentType: string, document: any, version: any, inline: boolean, method: string) {
  // Fix content type for PDFs if not properly detected
  let finalContentType = contentType;
  if (document.name.toLowerCase().endsWith('.pdf') && !contentType.includes('pdf')) {
    finalContentType = 'application/pdf';
    console.log(`[SecureDownload-${method}] Corrected content type to application/pdf for ${document.name}`);
  }

  // Determine file extension from document name or content type
  let fileExtension = '';
  if (document.name.includes('.')) {
    fileExtension = '.' + document.name.split('.').pop();
  } else if (finalContentType.includes('pdf')) {
    fileExtension = '.pdf';
  } else if (finalContentType.includes('word') || finalContentType.includes('document')) {
    fileExtension = '.docx';
  } else if (finalContentType.includes('text')) {
    fileExtension = '.txt';
  } else if (finalContentType.includes('spreadsheet') || finalContentType.includes('excel')) {
    fileExtension = '.xlsx';
  }

  // Determine content disposition
  let contentDisposition: string;
  if (inline && (finalContentType === 'application/pdf' || finalContentType.includes('pdf'))) {
    contentDisposition = `inline; filename="${encodeURIComponent(document.name)}_v${version.versionNumber}${fileExtension}"`;
  } else {
    contentDisposition = `attachment; filename="${encodeURIComponent(document.name)}_v${version.versionNumber}${fileExtension}"`;
  }

  console.log(`[SecureDownload-${method}] Success: ${document.name}, Size: ${buffer.byteLength} bytes, ContentType: ${finalContentType}`);

  // Return the file with proper headers
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': finalContentType,
      'Content-Length': buffer.byteLength.toString(),
      'Content-Disposition': contentDisposition,
      'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
      // Add additional headers for PDF viewing
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': 'bytes',
      'X-Frame-Options': 'SAMEORIGIN', // Allow iframe embedding for PDF preview
    },
  });
}

async function handleRequest(request: NextRequest, method: 'GET' | 'HEAD' = 'GET') {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      console.error(`[SecureDownload-${method}] No session found`);
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

    // Determine the best URL to use based on file type
    let fileUrl: string = version.fileUrl; // Default to stored URL
    console.log(`[SecureDownload-${method}] Default stored URL: ${fileUrl}`);
    
    // For PDFs, try to generate a proper URL with the new PDF-specific logic
    if (version.cloudinaryPublicId) {
      try {
        const generatedUrl = generateSignedUrl(version.cloudinaryPublicId, {
          expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
        });
        console.log(`[SecureDownload-${method}] Generated URL: ${generatedUrl}`);
        console.log(`[SecureDownload-${method}] Stored URL: ${fileUrl}`);
        
        // Use the generated URL if we have a public ID (should be PDF-optimized now)
        fileUrl = generatedUrl;
        console.log(`[SecureDownload-${method}] Using generated URL for better PDF access`);
      } catch (error) {
        console.error("Failed to generate Cloudinary URL:", error);
        console.log(`[SecureDownload-${method}] Falling back to stored URL`);
        // fileUrl remains the stored URL
      }
    }

    console.log(`[SecureDownload-${method}] User: ${session.user.email}, Document: ${document.name}, Version: ${version.versionNumber}, Inline: ${inline}`);

    // For HEAD requests, return early with just headers (no body)
    if (method === 'HEAD') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf', // Assume PDF for HEAD request
          'Cache-Control': 'private, max-age=3600',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD',
        },
      });
    }

    // Fetch the file
    console.log(`[SecureDownload-${method}] Attempting to fetch: ${fileUrl}`);
    console.log(`[SecureDownload-${method}] Document info:`, {
      id: document.id,
      name: document.name,
      versionId: version.id,
      cloudinaryPublicId: version.cloudinaryPublicId,
      fileUrl: version.fileUrl
    });
    
    const response = await fetch(fileUrl, {
      method: 'GET',
      headers: {
        'Accept': '*/*',
        'User-Agent': 'DMS-SecureDownload/1.0',
      },
    });

    if (!response.ok) {
      console.error(`[SecureDownload-${method}] Failed to fetch file: ${response.status} ${response.statusText}`);
      console.error(`[SecureDownload-${method}] Failed URL: ${fileUrl}`);
      
      // Since we're already using the stored URL, there's no fallback needed
      // But let's log what we tried
      console.error(`[SecureDownload-${method}] The stored URL failed to fetch. This indicates a problem with the file in Cloudinary.`);
      console.error(`[SecureDownload-${method}] You may need to re-upload this document.`);
      
      return NextResponse.json(
        { error: `Failed to fetch file: ${response.statusText}. Please try again or contact support.` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const buffer = await response.arrayBuffer();

    console.log(`[SecureDownload-${method}] ContentType detected: ${contentType}, Buffer size: ${buffer.byteLength}, Inline: ${inline}`);

    if (buffer.byteLength === 0) {
      console.error(`[SecureDownload-${method}] Empty file - Document: ${document.name}, Version: ${version.versionNumber}, URL: ${fileUrl}`);
      return NextResponse.json(
        { error: "File is empty or could not be retrieved from storage" },
        { status: 500 }
      );
    }

    // Process the successful response
    return processSuccessfulResponse(buffer, contentType, document, version, inline, method);
  } catch (error) {
    console.error(`[SecureDownload-${method}] Error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to download file" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleRequest(request, 'GET');
}

export async function HEAD(request: NextRequest) {
  return handleRequest(request, 'HEAD');
}
