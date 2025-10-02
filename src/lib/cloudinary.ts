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
    
    // For documents like PDF, DOC, etc., use "raw" to preserve original format
    if (fileExtension && ['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx'].includes(fileExtension)) {
      resourceType = "raw";
    }

    cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
        folder,
        public_id: fileName,
        use_filename: true,
        unique_filename: false,
        // Preserve original format for documents
        format: fileExtension,
        // Add flags for better PDF handling
        flags: resourceType === "raw" ? "attachment" : undefined,
      },
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
    // For raw files, we need to use the raw resource type
    const resourceType = publicId.includes('.pdf') || publicId.includes('.doc') || 
                        publicId.includes('.txt') || publicId.includes('.xls') ? 'raw' : 'auto';
    
    const signedUrl = cloudinary.url(publicId, {
      resource_type: resourceType,
      sign_url: true,
      secure: true,
      ...options
    });
    
    return signedUrl;
  } catch (error) {
    console.error("Error generating signed URL:", error);
    throw error;
  }
};

export default cloudinary;