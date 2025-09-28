"use client";

import { useState } from "react";
import { ArrowLeft, Folder, Plus, FileText, Upload } from "lucide-react";
import { Layout } from "~/components/Layout";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { FileUploader } from "~/components/FileUploader";
import { DocumentVersionManager } from "~/components/DocumentVersionManager";
import { useToast } from "~/components/providers/toast-provider";
import { api } from "~/trpc/react";
import Link from "next/link";

interface CategoryDetailClientProps {
  categoryId: string;
}

export function CategoryDetailClient({ categoryId }: CategoryDetailClientProps) {
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [newDocumentName, setNewDocumentName] = useState("");
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const { addToast } = useToast();

  // Queries
  const { data: categories } = api.admin.getCategories.useQuery();
  const { data: folders, refetch: refetchFolders } = api.admin.getFoldersByCategory.useQuery(
    { categoryId }
  );
  const { data: documents, refetch: refetchDocuments } = api.admin.getDocumentsByFolder.useQuery(
    { folderId: selectedFolder },
    { enabled: !!selectedFolder }
  );

  // Mutations
  const createFolderMutation = api.admin.createFolder.useMutation();
  const createDocumentMutation = api.admin.createDocument.useMutation();

  const currentCategory = categories?.find((c: any) => c.id === categoryId);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    
    try {
      await createFolderMutation.mutateAsync({
        name: newFolderName.trim(),
        categoryId,
        isPersonal: false,
      });
      setNewFolderName("");
      await refetchFolders();
      addToast({
        type: "success",
        title: "Folder created",
        description: `Folder "${newFolderName.trim()}" has been created successfully.`,
      });
    } catch (error) {
      console.error("Failed to create folder:", error);
      addToast({
        type: "error",
        title: "Failed to create folder",
        description: "Please try again later.",
      });
    }
  };

  const handleDocumentUpload = async (url: string, fileName: string, originalName: string) => {
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
        description: "Failed to create document. Please try again.",
      });
    }
  };

  if (!currentCategory) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Category not found</p>
            <Link href="/admin/categories">
              <Button className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Categories
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
            <Link href="/admin/categories">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">{currentCategory.name}</h1>
              <p className="text-muted-foreground">
                Manage folders and documents in this category
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Folders Section */}
          <div className="space-y-6">
            {/* Create New Folder */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Create Folder
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

            {/* Folders List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Folder className="h-5 w-5" />
                  Folders ({folders?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {folders && folders.length > 0 ? (
                  <div className="space-y-2">
                    {folders.map((folder: any) => (
                      <div
                        key={folder.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedFolder === folder.id
                            ? "bg-primary/10 border-primary"
                            : "hover:bg-muted"
                        }`}
                        onClick={() => setSelectedFolder(folder.id)}
                      >
                        <div className="flex items-center gap-2">
                          <Folder className="h-4 w-4" />
                          <span className="font-medium">{folder.name}</span>
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
                    <p>No folders yet. Create one above.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Documents Section */}
          <div className="space-y-6">
            {/* Upload Document */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Document
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedFolder ? (
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
                    <p>Select a folder first to upload documents</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Documents List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Documents ({documents?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedFolder ? (
                  documents && documents.length > 0 ? (
                    <div className="space-y-4">
                      {documents.map((document:any) => (
                        <div key={document.id}>
                          <DocumentVersionManager
                            documentId={document.id}
                            documentName={document.name}
                            canUploadVersions={true}
                            canDelete={true}
                            isAdmin={true}
                            onDocumentDelete={async () => {
                              await refetchDocuments();
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No documents in this folder yet.</p>
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
      </div>
    </Layout>
  );
}