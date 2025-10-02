"use client";

import { useState } from "react";
import { History, Upload, Eye, Download, FileText, Clock, User, Trash2, AlertTriangle, Copy } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { FileUploader } from "~/components/FileUploader";
import { DocumentComments } from "~/components/DocumentComments";
import { CloneDocumentModal } from "~/components/CloneDocumentModal";
import { useToast } from "~/components/providers/toast-provider";
import { formatDate } from "~/lib/utils";
import { api } from "~/trpc/react";

interface DocumentVersionManagerProps {
  documentId: string;
  documentName: string;
  canUploadVersions: boolean;
  canDelete: boolean;
  isAdmin?: boolean;
  isOwnDocument?: boolean;
  isPersonalFolder?: boolean;
  onDocumentDelete?: () => void;
  onDocumentClone?: () => void;
}

export function DocumentVersionManager({ 
  documentId, 
  documentName, 
  canUploadVersions,
  canDelete,
  isAdmin = false,
  isOwnDocument = false,
  isPersonalFolder = false,
  onDocumentDelete,
  onDocumentClone
}: DocumentVersionManagerProps) {
  const [showVersions, setShowVersions] = useState(false);
  const [isUploadingVersion, setIsUploadingVersion] = useState(false);
  const [deletingVersionId, setDeletingVersionId] = useState<string | null>(null);
  const [confirmDeleteDocument, setConfirmDeleteDocument] = useState(false);
  const [confirmDeleteVersion, setConfirmDeleteVersion] = useState<string | null>(null);
  const [showCloneModal, setShowCloneModal] = useState(false);
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

  const handleVersionUpload = async (url: string, fileName: string, originalName: string, publicId?: string) => {
    setIsUploadingVersion(true);
    try {
      const result = await createVersionMutation.mutateAsync({
        documentId,
        fileUrl: url,
        cloudinaryPublicId: publicId,
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

  const handleDownload = async (versionId: string, versionNumber: number) => {
    try {
      addToast({
        type: "info",
        title: "Download started",
        description: `Downloading version ${versionNumber} of "${documentName}"...`,
      });

      // Use our secure download API route
      const downloadUrl = `/api/download-secure?versionId=${encodeURIComponent(versionId)}`;
      
      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${documentName}_v${versionNumber}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
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

  const handleView = async (versionId: string, versionNumber: number) => {
    try {
      // Use our secure download API route with inline parameter for viewing
      const viewUrl = `/api/download-secure?versionId=${encodeURIComponent(versionId)}&inline=true`;
      
      // Check if the URL is accessible before opening
      const testResponse = await fetch(viewUrl, { method: 'HEAD' });
      if (!testResponse.ok) {
        console.error(`View failed: ${testResponse.status} ${testResponse.statusText}`);
        addToast({
          type: "error",
          title: "View failed",
          description: `Failed to access document: ${testResponse.statusText}. Please check if the file exists and you have permission to view it.`,
        });
        return;
      }
      
      const newWindow = window.open(viewUrl, '_blank');
      if (!newWindow) {
        addToast({
          type: "error",
          title: "Popup blocked",
          description: "Please allow popups for this site to view documents.",
        });
      }
    } catch (error) {
      console.error("View failed:", error);
      addToast({
        type: "error",
        title: "View failed",
        description: error instanceof Error ? error.message : "Failed to view the document. Please try again.",
      });
    }
  };

  const handleCloneSuccess = () => {
    onDocumentClone?.();
    addToast({
      type: "success",
      title: "Document cloned",
      description: `"${documentName}" has been cloned to your personal folder.`,
    });
  };

  // Determine if user can clone this document (not their own document or not in personal folder)
  const canClone = !isAdmin && (!isOwnDocument || !isPersonalFolder);

  return (
    <div className="space-y-4">
      {/* Version Management Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-2">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 flex-shrink-0" />
          <span className="truncate">{documentName}</span>
        </h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowVersions(!showVersions)}
            className="w-full sm:w-auto"
          >
            <History className="h-4 w-4 mr-2" />
            {showVersions ? "Hide" : "Show"} Versions ({versions?.length || 0})
          </Button>
          {canClone && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCloneModal(true)}
              className="w-full sm:w-auto"
            >
              <Copy className="h-4 w-4 mr-2" />
              Clone Document
            </Button>
          )}
          {canDelete && !confirmDeleteDocument && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDeleteDocument(true)}
              className="text-destructive hover:text-destructive w-full sm:w-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              <span className="sm:hidden">Delete Document</span>
              <span className="hidden sm:inline">Delete</span>
            </Button>
          )}
          {confirmDeleteDocument && (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <span className="text-sm text-destructive font-medium px-2 py-1 sm:py-0 text-center sm:text-left">
                Delete document?
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDeleteDocument}
                  disabled={deleteDocumentMutation.isPending}
                  className="flex-1 sm:flex-none"
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
                  className="flex-1 sm:flex-none"
                >
                  Cancel
                </Button>
              </div>
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
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex items-center gap-2 flex-shrink-0">
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
                          
                          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleView(version.id, version.versionNumber)}
                                className="flex-1 sm:flex-none"
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                <span className="sm:hidden">View</span>
                                <span className="hidden sm:inline">View</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownload(version.id, version.versionNumber)}
                                className="flex-1 sm:flex-none"
                              >
                                <Download className="h-4 w-4 mr-1" />
                                <span className="sm:hidden">Download</span>
                                <span className="hidden sm:inline">Download</span>
                              </Button>
                              {canDelete && versions && versions.length > 1 && (
                                <>
                                  {confirmDeleteVersion === version.id ? (
                                    <div className="flex gap-1 flex-1 sm:flex-none">
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => handleDeleteVersion(version.id, version.versionNumber)}
                                        disabled={deletingVersionId === version.id}
                                        className="flex-1 sm:flex-none"
                                      >
                                        {deletingVersionId === version.id ? (
                                          <div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                                        ) : (
                                          <>
                                            <span className="sm:hidden">Delete</span>
                                            <span className="hidden sm:inline">Delete</span>
                                          </>
                                        )}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setConfirmDeleteVersion(null)}
                                        className="flex-1 sm:flex-none"
                                      >
                                        <span className="sm:hidden">Cancel</span>
                                        <span className="hidden sm:inline">Cancel</span>
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setConfirmDeleteVersion(version.id)}
                                      className="text-destructive hover:text-destructive flex-shrink-0"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{formatDate(version.createdAt)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">
                              Uploaded by {version.uploadedBy || version.uploadedByEmail}
                            </span>
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

      {/* Document Comments */}
      <DocumentComments 
        documentId={documentId}
        documentName={documentName}
        isAdmin={isAdmin}
        canComment={true}
      />

      {/* Clone Document Modal */}
      <CloneDocumentModal
        isOpen={showCloneModal}
        onClose={() => setShowCloneModal(false)}
        documentId={documentId}
        documentName={documentName}
        onCloneSuccess={handleCloneSuccess}
      />
    </div>
  );
}