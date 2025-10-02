"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowLeft, Folder, Plus, FileText, Upload, Eye, Edit, Lock } from "lucide-react";
import { Layout } from "~/components/Layout";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { FileUploader } from "~/components/FileUploader";
import { DocumentVersionManager } from "~/components/DocumentVersionManager";
import { useToast } from "~/components/providers/toast-provider";
import { api } from "~/trpc/react";

interface LibraryCategoryClientProps {
  categoryId: string;
}

export function LibraryCategoryClient({ categoryId }: LibraryCategoryClientProps) {
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [newDocumentName, setNewDocumentName] = useState("");
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const { addToast } = useToast();
  const { data: session } = useSession();

  // Queries
  const { data: categories } = api.user.getAccessibleCategories.useQuery();
  const { data: folders, refetch: refetchFolders } = api.user.getFoldersByCategory.useQuery(
    { categoryId }
  );
  const { data: documents, refetch: refetchDocuments } = api.user.getDocumentsByFolder.useQuery(
    { folderId: selectedFolder },
    { enabled: !!selectedFolder }
  );

  // Mutations
  const createFolderMutation = api.user.createPersonalFolder.useMutation();
  const createDocumentMutation = api.user.createDocument.useMutation();

  const currentCategory = categories?.find(c => c.id === categoryId);
  const canWrite = currentCategory?.accessLevel === "full";

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    
    try {
      await createFolderMutation.mutateAsync({
        name: newFolderName.trim(),
        categoryId,
      });
      setNewFolderName("");
      await refetchFolders();
      addToast({
        type: "success",
        title: "Personal folder created",
        description: `Folder "${newFolderName.trim()}" has been created successfully.`,
      });
    } catch (error) {
      console.error("Failed to create folder:", error);
      addToast({
        type: "error",
        title: "Failed to create folder",
        description: "Please check your permissions and try again.",
      });
    }
  };

  const handleDocumentUpload = async (url: string, fileName: string, originalName: string, publicId?: string) => {
    if (!selectedFolder || !newDocumentName.trim()) {
      addToast({
        type: "warning",
        title: "Missing information",
        description: "Please select a folder and enter a document name.",
      });
      return;
    }

    setIsUploadingDocument(true);
    try {
      await createDocumentMutation.mutateAsync({
        name: newDocumentName.trim(),
        folderId: selectedFolder,
        cloudinaryUrl: url,
        cloudinaryPublicId: publicId,
      });
      setNewDocumentName("");
      setIsUploadingDocument(false);
      await refetchDocuments();
      addToast({
        type: "success",
        title: "Document uploaded",
        description: `"${newDocumentName.trim()}" has been uploaded successfully.`,
      });
    } catch (error) {
      console.error("Failed to create document:", error);
      setIsUploadingDocument(false);
      addToast({
        type: "error",
        title: "Upload failed",
        description: "Failed to create document. Please check your permissions.",
      });
    }
  };

  if (!currentCategory) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Category not found or access denied</p>
            <Link href="/library">
              <Button className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Library
              </Button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/library">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Library
              </Button>
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{currentCategory.name}</h1>
                <Badge 
                  variant={canWrite ? "default" : "secondary"}
                  className="flex items-center gap-1"
                >
                  {canWrite ? (
                    <>
                      <Edit className="h-3 w-3" />
                      Full Access
                    </>
                  ) : (
                    <>
                      <Eye className="h-3 w-3" />
                      Read Only
                    </>
                  )}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {canWrite 
                  ? "Browse folders and documents, create your personal content"
                  : "Browse folders and documents (read-only access)"
                }
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Folders Section */}
          <div className="space-y-6">
            {/* Create New Personal Folder */}
            {canWrite && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Create Personal Folder
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Folder name"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          void handleCreateFolder();
                        }
                      }}
                    />
                    <Button 
                      onClick={handleCreateFolder}
                      disabled={!newFolderName.trim() || createFolderMutation.isPending}
                    >
                      Create
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Folders List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Folder className="h-5 w-5" />
                  Available Folders ({folders?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {folders && folders.length > 0 ? (
                  <div className="space-y-2">
                    {folders.map((folder) => (
                      <div
                        key={folder.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedFolder === folder.id
                            ? "bg-primary/10 border-primary"
                            : "hover:bg-muted"
                        }`}
                        onClick={() => setSelectedFolder(folder.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Folder className="h-4 w-4" />
                            <span className="font-medium">{folder.name}</span>
                          </div>
                          {folder.isPersonal && (
                            <Badge variant="outline" className="text-xs">
                              Personal
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Created {new Date(folder.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No folders available.</p>
                    {canWrite && <p className="text-sm">Create a personal folder above.</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Documents Section */}
          <div className="space-y-6">
            {/* Upload Document */}
            {canWrite && selectedFolder && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Upload Document
                    {folders?.find(f => f.id === selectedFolder)?.isPersonal ? (
                      <Badge variant="default" className="ml-2">Personal Folder</Badge>
                    ) : (
                      <Badge variant="secondary" className="ml-2">Shared Folder</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {folders?.find(f => f.id === selectedFolder)?.isPersonal ? (
                    <div className="space-y-4">
                      <Input
                        placeholder="Document name"
                        value={newDocumentName}
                        onChange={(e) => setNewDocumentName(e.target.value)}
                      />
                      <FileUploader
                        onUpload={handleDocumentUpload}
                        disabled={isUploadingDocument || !newDocumentName.trim()}
                      />
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <Lock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="font-medium">Cannot upload to shared folders</p>
                      <p className="text-sm">You can only upload documents to your personal folders.</p>
                      <p className="text-sm">Use the clone feature to copy documents to your personal folders.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Documents List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Documents ({documents?.length || 0})
                  {!canWrite && (
                    <Lock className="h-4 w-4 text-muted-foreground ml-2" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedFolder ? (
                  documents && documents.length > 0 ? (
                    <div className="space-y-4">
                      {documents.map((document) => {
                        const selectedFolderData = folders?.find(f => f.id === selectedFolder);
                        const isOwnDocument = document.createdBy === session?.user?.id;
                        const isPersonalFolder = selectedFolderData?.isPersonal === true;
                        
                        return (
                          <div key={document.id}>
                            <DocumentVersionManager
                              documentId={document.id}
                              documentName={document.name}
                              canUploadVersions={isOwnDocument && isPersonalFolder}
                              canDelete={isOwnDocument && isPersonalFolder}
                              isAdmin={false}
                              isOwnDocument={isOwnDocument}
                              isPersonalFolder={isPersonalFolder}
                              onDocumentDelete={async () => {
                                await refetchDocuments();
                              }}
                              onDocumentClone={async () => {
                                await refetchDocuments();
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No documents in this folder yet.</p>
                      {canWrite && <p className="text-sm">Upload your first document above.</p>}
                    </div>
                  )
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <p>Select a folder to view documents</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Access Level Info */}
        {!canWrite && (
          <div className="mt-8">
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Lock className="h-5 w-5 text-blue-600" />
                  <div>
                    <h3 className="font-medium text-blue-900">Read-Only Access</h3>
                    <p className="text-sm text-blue-700">
                      You have read-only access to this category. You can view documents but cannot create, edit, or delete content.
                      Contact your administrator if you need additional permissions.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}