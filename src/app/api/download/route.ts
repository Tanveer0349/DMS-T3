import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "~/server/auth";

async function handleRequest(request: NextRequest, method: 'GET' | 'HEAD' = 'GET') {
  try {
    // Try to get session using the same method as upload route
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      console.error(`[Download-${method}] No session found`);
      return NextResponse.json({ error: "Unauthorized - Please log in" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const fileUrl = searchParams.get("url");
    const fileName = searchParams.get("filename");
    const inline = searchParams.get("inline") === "true";

    if (!fileUrl) {
      return NextResponse.json({ error: "File URL is required" }, { status: 400 });
    }

    // Validate that the URL is from your Cloudinary account
    if (!fileUrl.includes('res.cloudinary.com')) {
      return NextResponse.json({ error: "Invalid file URL" }, { status: 400 });
    }

    console.log(`[Download-${method}] User: ${session.user.email}, File: ${fileName}, URL: ${fileUrl}, Inline: ${inline}`);

    // For HEAD requests, return early with just headers (no body)
    if (method === 'HEAD') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf', // Assume PDF for HEAD request
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, HEAD',
        },
      });
    }

    // Fetch the file from Cloudinary
    const response = await fetch(fileUrl, {
      method: 'GET',
      headers: {
        'Accept': '*/*',
        'User-Agent': 'DMS-Download-Service/1.0',
      },
    });

    if (!response.ok) {
      console.error(`[Download] Failed to fetch file: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `Failed to fetch file from Cloudinary: ${response.statusText}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const buffer = await response.arrayBuffer();

    console.log(`[Download] ContentType detected: ${contentType}, Inline: ${inline}, FileName: ${fileName}`);

    // Determine content disposition based on file type and inline parameter
    let contentDisposition: string;
    
    // Fix content type for PDFs if not properly detected
    let finalContentType = contentType;
    if (fileName && fileName.toLowerCase().endsWith('.pdf') && !contentType.includes('pdf')) {
      finalContentType = 'application/pdf';
      console.log(`[Download] Corrected content type to application/pdf for ${fileName}`);
    }
    
    if (inline && (finalContentType === 'application/pdf' || finalContentType.includes('pdf'))) {
      contentDisposition = fileName 
        ? `inline; filename="${encodeURIComponent(fileName)}"` 
        : 'inline';
    } else {
      // Determine file extension from content type or filename
      let fileExtension = '';
      if (finalContentType.includes('pdf')) fileExtension = '.pdf';
      else if (finalContentType.includes('word') || finalContentType.includes('document')) fileExtension = '.docx';
      else if (finalContentType.includes('text')) fileExtension = '.txt';
      else if (finalContentType.includes('spreadsheet') || finalContentType.includes('excel')) fileExtension = '.xlsx';
      else if (fileName && fileName.includes('.')) {
        fileExtension = '.' + fileName.split('.').pop();
      }

      contentDisposition = fileName 
        ? `attachment; filename="${encodeURIComponent(fileName)}${fileExtension}"` 
        : 'attachment';
    }

    // Check if file is empty
    if (buffer.byteLength === 0) {
      console.error('[Download] File is empty');
      return NextResponse.json(
        { error: "File is empty or could not be retrieved from Cloudinary" },
        { status: 500 }
      );
    }

    console.log(`[Download] Success: ${fileName}, Size: ${buffer.byteLength} bytes, ContentType: ${contentType}, Inline: ${inline}`);

    // Return the file with proper headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': finalContentType,
        'Content-Length': buffer.byteLength.toString(),
        'Content-Disposition': contentDisposition,
        'Cache-Control': 'no-cache',
        // Add CORS headers for better browser compatibility
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Allow-Headers': 'Content-Type',
        // Add additional headers for PDF viewing
        'X-Content-Type-Options': 'nosniff',
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (error) {
    console.error(`[Download-${method}] Error:`, error);
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

// Also support POST method for better compatibility
export async function POST(request: NextRequest) {
  return handleRequest(request, 'GET');
}