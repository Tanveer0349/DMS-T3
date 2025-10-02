import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "~/server/auth";

export async function GET(request: NextRequest) {
  try {
    // Try to get session using the same method as upload route
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      console.error('[Download] No session found');
      return NextResponse.json({ error: "Unauthorized - Please log in" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const fileUrl = searchParams.get("url");
    const fileName = searchParams.get("filename");

    if (!fileUrl) {
      return NextResponse.json({ error: "File URL is required" }, { status: 400 });
    }

    // Validate that the URL is from your Cloudinary account
    if (!fileUrl.includes('res.cloudinary.com')) {
      return NextResponse.json({ error: "Invalid file URL" }, { status: 400 });
    }

    console.log(`[Download] User: ${session.user.email}, File: ${fileName}`);

    // Fetch the file from Cloudinary
    const response = await fetch(fileUrl, {
      method: 'GET',
      headers: {
        'Accept': '*/*',
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

    // Check if file is empty
    if (buffer.byteLength === 0) {
      console.error('[Download] File is empty');
      return NextResponse.json(
        { error: "File is empty or could not be retrieved from Cloudinary" },
        { status: 500 }
      );
    }

    console.log(`[Download] Success: ${fileName}, Size: ${buffer.byteLength} bytes`);

    // Return the file with proper headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': buffer.byteLength.toString(),
        'Content-Disposition': fileName 
          ? `attachment; filename="${encodeURIComponent(fileName)}"` 
          : 'attachment',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error("[Download] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to download file" },
      { status: 500 }
    );
  }
}

// Also support POST method for better compatibility
export async function POST(request: NextRequest) {
  return GET(request);
}