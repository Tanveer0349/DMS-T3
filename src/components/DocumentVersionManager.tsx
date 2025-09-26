"use client";

import { useState } from "react";
import { History, Upload, Eye, Download, FileText, Clock, User, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { FileUploader } from "~/components/FileUploader";
import { useToast } from "~/components/providers/toast-provider";
import { formatDate } from "~/lib/utils";
import { api } from "~/trpc/react";

interface DocumentVersionManagerProps {
  documentId: string;
  documentName: string;
  canUploadVersions: boolean;
  canDelete: boolean;
  isAdmin?: boolean;
  onDocumentDelete?: () => void;
}

export function DocumentVersionManager({ 
  documentId, 
  documentName, 
  canUploadVersions,
  canDelete,
  isAdmin = false,
  onDocumentDelete
}: DocumentVersionManagerProps) {
  const [showVersions, setShowVersions] = useState(false);
  const [isUploadingVersion, setIsUploadingVersion] = useState(false);
  const [deletingVersionId, setDeletingVersionId] = useState<string | null>(null);
  const [confirmDeleteDocument, setConfirmDeleteDocument] = useState(false);
  const [confirmDeleteVersion, setConfirmDeleteVersion] = useState<string | null>(null);
  const { addToast } = useToast();

  // Queries
  const { data: versions, refetch: refetchVersions } = isAdmin 
    ? api.admin.getDocumentVersions.useQuery({ documentId }, { enabled: showVersions })
    : api.user.getDocumentVersions.useQuery({ documentId }, { enabled: showVersions });

  // Mutations
  const createVersionMutation = isAdmin
    ? api.admin.createDocumentVersion.useMutation()
    : api.user.createDocumentVersion.useMutation();

  const deleteDocumentMutation = isAdmin
    ? api.admin.deleteDocument.useMutation()
    : api.user.deleteDocument.useMutation();

  const deleteVersionMutation = isAdmin
    ? api.admin.deleteDocumentVersion.useMutation()
    : api.user.deleteDocumentVersion.useMutation();

  const handleVersionUpload = async (url: string, fileName: string, originalName: string) => {
    setIsUploadingVersion(true);
    try {
      const result = await createVersionMutation.mutateAsync({
        documentId,
        fileUrl: url,
      });
      await refetchVersions();
      setIsUploadingVersion(false);
      
      addToast({
        type: "success",
        title: "Version uploaded successfully",
        description: `Version ${result.versionNumber} of "${documentName}" has been created.`,
      });
    } catch (error) {
      console.error("Failed to create version:", error);
      setIsUploadingVersion(false);
      
      addToast({
        type: "error",
        title: "Upload failed",
        description: "Failed to create new document version. Please try again.",
      });
    }
  };

  const handleDeleteDocument = async () => {
    try {
      await deleteDocumentMutation.mutateAsync({ id: documentId });
      
      addToast({
        type: "success",
        title: "Document deleted",
        description: `"${documentName}" has been permanently deleted.`,
      });

      onDocumentDelete?.();
    } catch (error) {
      console.error("Failed to delete document:", error);
      addToast({
        type: "error",
        title: "Delete failed",
        description: "Failed to delete document. Please try again.",
      });
    } finally {
      setConfirmDeleteDocument(false);
    }
  };

  const handleDeleteVersion = async (versionId: string, versionNumber: number) => {
    setDeletingVersionId(versionId);
    try {
      await deleteVersionMutation.mutateAsync({ 
        versionId, 
        documentId 
      });
      
      await refetchVersions();
      
      addToast({
        type: "success",
        title: "Version deleted",
        description: `Version ${versionNumber} has been deleted successfully.`,
      });
    } catch (error: any) {
      console.error("Failed to delete version:", error);
      addToast({
        type: "error",
        title: "Delete failed",
        description: error.message || "Failed to delete version. Please try again.",
      });
    } finally {
      setDeletingVersionId(null);
      setConfirmDeleteVersion(null);
    }
  };

  const handleDownload = async (url: string, fileName: string, versionNumber: number) => {
    try {
      addToast({
        type: "info",
        title: "Download started",
        description: `Downloading version ${versionNumber} of "${documentName}"...`,
      });

      // Create a temporary link and trigger download
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${fileName}_v${versionNumber}.${url.split('.').pop() || 'file'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Cleanup
      window.URL.revokeObjectURL(downloadUrl);
      
      addToast({
        type: "success",
        title: "Download complete",
        description: `Version ${versionNumber} downloaded successfully.`,
      });
    } catch (error) {
      console.error("Download failed:", error);
      addToast({
        type: "error",
        title: "Download failed",
        description: "Failed to download the document. Please try again.",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Version Management Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {documentName}
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowVersions(!showVersions)}
          >
            <History className="h-4 w-4 mr-2" />
            {showVersions ? "Hide" : "Show"} Versions ({versions?.length || 0})
          </Button>
          {canDelete && !confirmDeleteDocument && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDeleteDocument(true)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
          {confirmDeleteDocument && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-destructive font-medium">Delete document?</span>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDeleteDocument}
                disabled={deleteDocumentMutation.isPending}
              >
                {deleteDocumentMutation.isPending ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  "Yes, Delete"
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmDeleteDocument(false)}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      {showVersions && (
        <div className="space-y-4">
          {/* Upload New Version */}
          {canUploadVersions && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Upload New Version
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FileUploader
                  onUpload={handleVersionUpload}
                  disabled={isUploadingVersion}
                />
              </CardContent>
            </Card>
          )}

          {/* Version History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" />
                Version History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {versions && versions.length > 0 ? (
                <div className="space-y-3">
                  {versions
                    .sort((a, b) => b.versionNumber - a.versionNumber)
                    .map((version, index) => (
                      <div
                        key={version.id}
                        className={`p-4 border rounded-lg ${
                          index === 0 ? "border-primary bg-primary/5" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              <span className="font-medium">
                                Version {version.versionNumber}
                              </span>
                              {index === 0 && (
                                <Badge variant="default" className="text-xs">
                                  Current
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(version.fileUrl, '_blank')}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(
                                version.fileUrl, 
                                documentName, 
                                version.versionNumber
                              )}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Download
                            </Button>
                            {canDelete && versions && versions.length > 1 && (
                              <>
                                {confirmDeleteVersion === version.id ? (
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleDeleteVersion(version.id, version.versionNumber)}
                                      disabled={deletingVersionId === version.id}
                                    >
                                      {deletingVersionId === version.id ? (
                                        <div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                                      ) : (
                                        "Delete"
                                      )}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setConfirmDeleteVersion(null)}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setConfirmDeleteVersion(version.id)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        
                        <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(version.createdAt)}
                          </div>
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            Uploaded by {version.uploadedBy || version.uploadedByEmail}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No versions available yet.</p>
                  {canUploadVersions && (
                    <p className="text-sm">Upload the first version above.</p>
                  )}
                </div>
              )}

              {/* Warning for single version */}
              {canDelete && versions && versions.length === 1 && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-800">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">
                      Cannot delete the only version. Delete the entire document instead.
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}