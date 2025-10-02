import { v2 as cloudinary } from "cloudinary";
import type { UploadApiResponse } from "cloudinary";
import { env } from "~/env.js";

// Configure cloudinary
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export const uploadToCloudinary = async (
  file: Buffer,
  fileName: string,
  folder: string = "dms"
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    // Determine resource type based on file extension
    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    let resourceType: "auto" | "image" | "video" | "raw" = "auto";
    
    // Special handling for PDFs vs other documents
    const isPdf = fileExtension === 'pdf';
    const isDocument = fileExtension && ['doc', 'docx', 'txt', 'xls', 'xlsx'].includes(fileExtension);
    
    // Try auto resource type for PDFs to avoid raw file restrictions
    if (isPdf) {
      resourceType = "auto"; // Let Cloudinary decide - often works better for PDFs
    } else if (isDocument) {
      resourceType = "raw"; // Keep raw for other documents
    }

    // PDF-specific upload options
    const uploadOptions: any = {
      resource_type: resourceType,
      folder,
      public_id: fileName,
      use_filename: true,
      unique_filename: false,
      // Preserve original format for documents
      format: fileExtension,
    };

    // For PDFs using auto resource type, use standard settings
    // No special restrictions needed when using 'auto' instead of 'raw'

    console.log(`[Cloudinary] Uploading ${fileExtension} file with resource_type: ${resourceType}, isPdf: ${isPdf}`);

    cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          reject(error);
        } else if (result) {
          console.log("Cloudinary upload success:", {
            public_id: result.public_id,
            resource_type: result.resource_type,
            format: result.format,
            secure_url: result.secure_url
          });
          resolve(result);
        } else {
          reject(new Error("Upload failed - no result returned"));
        }
      }
    ).end(file);
  });
};

export const deleteFromCloudinary = async (publicId: string) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error("Error deleting from Cloudinary:", error);
    throw error;
  }
};

export const generateSignature = (paramsToSign: Record<string, string>) => {
  return cloudinary.utils.api_sign_request(
    paramsToSign,
    env.CLOUDINARY_API_SECRET
  );
};

export const generateSignedUrl = (publicId: string, options: Record<string, any> = {}) => {
  try {
    // Determine file type and resource type (matching upload logic)
    const isPdf = publicId.includes('.pdf');
    const isDocument = publicId.includes('.doc') || publicId.includes('.txt') || 
                      publicId.includes('.xls') || publicId.includes('.docx') || publicId.includes('.xlsx');
    
    let resourceType: "auto" | "raw" = 'auto';
    if (isPdf) {
      resourceType = 'auto'; // Use auto for PDFs to avoid restrictions
    } else if (isDocument) {
      resourceType = 'raw'; // Keep raw for other documents
    }
    
    console.log(`[Cloudinary] Generating URL for ${publicId} (PDF: ${isPdf}, resourceType: ${resourceType})`);
    
    // For PDFs with auto resource type, use standard URL generation
    if (isPdf) {
      const directUrl = cloudinary.url(publicId, {
        resource_type: resourceType, // 'auto' - let Cloudinary handle it
        secure: true,
        type: 'upload',
      });
      console.log(`[Cloudinary] Generated auto URL for PDF: ${directUrl.substring(0, 100)}...`);
      return directUrl;
    }
    
    // For other raw files, try signed URL first, then fallback to direct
    if (resourceType === 'raw') {
      try {
        const signedUrl = cloudinary.url(publicId, {
          resource_type: resourceType,
          secure: true,
          type: 'upload',
          sign_url: true,
          expires_at: options.expires_at || Math.floor(Date.now() / 1000) + 7200, // 2 hours expiry
        });
        console.log(`[Cloudinary] Generated signed URL for raw file: ${signedUrl.substring(0, 100)}...`);
        return signedUrl;
      } catch (signError) {
        console.error(`[Cloudinary] Failed to generate signed URL for raw file:`, signError);
        // Fallback to direct URL
        const directUrl = cloudinary.url(publicId, {
          resource_type: resourceType,
          secure: true,
          type: 'upload',
        });
        console.log(`[Cloudinary] Fallback to direct URL for raw file: ${directUrl.substring(0, 100)}...`);
        return directUrl;
      }
    }
    
    // For other files, use signed URLs
    const signedUrl = cloudinary.url(publicId, {
      resource_type: resourceType,
      sign_url: true,
      secure: true,
      type: 'upload',
      expires_at: options.expires_at || Math.floor(Date.now() / 1000) + 3600, // Default 1 hour expiry
      ...options
    });
    
    console.log(`[Cloudinary] Generated signed URL: ${signedUrl.substring(0, 100)}...`);
    return signedUrl;
  } catch (error) {
    console.error("Error generating signed URL:", error);
    throw error;
  }
};

export default cloudinary;