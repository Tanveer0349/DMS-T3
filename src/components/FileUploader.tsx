import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, File, X, Loader2, CheckCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn, formatFileSize } from "~/lib/utils";

interface FileUploaderProps {
  onUpload: (url: string, fileName: string, originalName: string) => Promise<void>;
  accept?: Record<string, string[]>;
  maxSize?: number;
  disabled?: boolean;
  className?: string;
}

export function FileUploader({
  onUpload,
  accept = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
      ".docx",
    ],
    "application/msword": [".doc"],
    "application/pdf": [".pdf"],
    "text/plain": [".txt"],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    "application/vnd.ms-excel": [".xls"],
  },
  maxSize = 10 * 1024 * 1024, // 10MB
  disabled = false,
  className,
}: FileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [error, setError] = useState<string>("");

  const uploadFile = async (file: File): Promise<{ url: string; originalName: string }> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(errorData.error || "Upload failed");
    }

    const data = await response.json();
    return { url: data.url, originalName: data.originalName || file.name };
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setSelectedFile(file);
      setUploading(true);
      setUploadProgress(0);
      setError("");
      setUploadComplete(false);

      try {
        // Simulate progress for better UX
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => {
            if (prev >= 80) {
              clearInterval(progressInterval);
              return prev;
            }
            return prev + 20;
          });
        }, 200);

        const { url, originalName } = await uploadFile(file);
        
        clearInterval(progressInterval);
        setUploadProgress(90);

        await onUpload(url, file.name, originalName);
        
        setUploadProgress(100);
        setUploadComplete(true);
        
        // Reset after a delay
        setTimeout(() => {
          setSelectedFile(null);
          setUploading(false);
          setUploadProgress(0);
          setUploadComplete(false);
        }, 2000);
      } catch (error) {
        console.error("Upload failed:", error);
        setError(error instanceof Error ? error.message : "Upload failed");
        setUploading(false);
        setUploadProgress(0);
        setUploadComplete(false);
      }
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop,
      accept,
      maxSize,
      multiple: false,
      disabled: disabled || uploading,
    });

  const clearFile = () => {
    setSelectedFile(null);
    setUploading(false);
    setUploadProgress(0);
    setUploadComplete(false);
    setError("");
  };

  return (
    <div className={cn("w-full", className)}>
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-4 sm:p-6 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50",
          disabled || uploading ? "cursor-not-allowed opacity-50" : "",
          uploadComplete ? "border-green-500 bg-green-50" : ""
        )}
      >
        <input {...getInputProps()} />
        
        {selectedFile ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-2">
              {uploadComplete ? (
                <CheckCircle className="h-8 w-8 text-green-500" />
              ) : (
                <File className="h-8 w-8 text-primary" />
              )}
              <div className="text-center sm:text-left">
                <p className="font-medium text-sm sm:text-base break-all">{selectedFile.name}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
              {!uploading && !uploadComplete && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearFile();
                  }}
                  className="shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            {uploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">
                    {uploadProgress < 90 ? `Uploading... ${uploadProgress}%` : "Processing..."}
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {uploadComplete && (
              <div className="text-sm text-green-600 font-medium">
                ✓ Upload completed successfully!
              </div>
            )}

            {error && (
              <div className="text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Upload className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto" />
            <div>
              <p className="text-base sm:text-lg font-medium">
                {isDragActive ? "Drop the file here" : "Upload a document"}
              </p>
              <p className="text-sm text-muted-foreground px-2">
                Drag and drop or tap to select a file
              </p>
              <p className="text-xs text-muted-foreground mt-2 px-2">
                Supported: .doc, .docx, .pdf, .txt, .xlsx, .xls (max {formatFileSize(maxSize)})
              </p>
            </div>
          </div>
        )}
      </div>
      
      {fileRejections.length > 0 && (
        <div className="mt-2 text-sm text-destructive">
          {fileRejections[0]?.errors[0]?.message}
        </div>
      )}
    </div>
  );
}