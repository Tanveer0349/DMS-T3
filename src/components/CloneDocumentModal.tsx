"use client";

import { useState } from "react";
import { Copy, FolderPlus, Folder, Plus, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { useToast } from "~/components/providers/toast-provider";
import { api } from "~/trpc/react";

interface PersonalFolder {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  createdAt: Date;
}

interface CloneDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentName: string;
  onCloneSuccess?: () => void;
}

export function CloneDocumentModal({
  isOpen,
  onClose,
  documentId,
  documentName,
  onCloneSuccess,
}: CloneDocumentModalProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [newDocumentName, setNewDocumentName] = useState(`${documentName} (Copy)`);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedCategoryForNewFolder, setSelectedCategoryForNewFolder] = useState("");
  const { addToast } = useToast();

  // Queries
  const { data: personalFolders, refetch: refetchPersonalFolders } = 
    api.user.getPersonalFoldersForCloning.useQuery(undefined, { enabled: isOpen });
  
  const { data: categories } = api.user.getAccessibleCategories.useQuery(undefined, { enabled: isOpen });

  // Mutations
  const cloneDocumentMutation = api.user.cloneDocument.useMutation();
  const createPersonalFolderMutation = api.user.createPersonalFolder.useMutation();

  // Group folders by category
  const foldersByCategory = personalFolders?.reduce((acc, folder) => {
    if (!acc[folder.categoryName]) {
      acc[folder.categoryName] = [];
    }
    acc[folder.categoryName]!.push(folder);
    return acc;
  }, {} as Record<string, PersonalFolder[]>) || {};

  const handleCloneDocument = async () => {
    if (!selectedFolderId || !newDocumentName.trim()) {
      addToast({
        type: "error",
        title: "Invalid selection",
        description: "Please select a folder and provide a document name.",
      });
      return;
    }

    try {
      const result = await cloneDocumentMutation.mutateAsync({
        documentId,
        targetFolderId: selectedFolderId,
        newName: newDocumentName.trim(),
      });

      addToast({
        type: "success",
        title: "Document cloned successfully",
        description: `"${result.name}" has been cloned to your personal folder.`,
      });

      onCloneSuccess?.();
      onClose();
      resetForm();
    } catch (error) {
      console.error("Failed to clone document:", error);
      addToast({
        type: "error",
        title: "Clone failed",
        description: "Failed to clone the document. Please try again.",
      });
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !selectedCategoryForNewFolder) {
      addToast({
        type: "error",
        title: "Invalid input",
        description: "Please provide a folder name and select a category.",
      });
      return;
    }

    try {
      const result = await createPersonalFolderMutation.mutateAsync({
        name: newFolderName.trim(),
        categoryId: selectedCategoryForNewFolder,
      });

      // Select the newly created folder
      setSelectedFolderId(result.id);
      setIsCreatingFolder(false);
      setNewFolderName("");
      setSelectedCategoryForNewFolder("");
      
      // Refresh the folders list
      await refetchPersonalFolders();

      addToast({
        type: "success",
        title: "Folder created",
        description: `Personal folder "${result.name}" has been created.`,
      });
    } catch (error) {
      console.error("Failed to create folder:", error);
      addToast({
        type: "error",
        title: "Creation failed",
        description: "Failed to create the folder. Please try again.",
      });
    }
  };

  const resetForm = () => {
    setSelectedFolderId("");
    setNewDocumentName(`${documentName} (Copy)`);
    setIsCreatingFolder(false);
    setNewFolderName("");
    setSelectedCategoryForNewFolder("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Copy className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Clone Document</h2>
              <p className="text-sm text-muted-foreground">
                Clone "{documentName}" to your personal folder
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[calc(90vh-200px)] overflow-y-auto">
          {/* Document Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Document Name</label>
            <Input
              value={newDocumentName}
              onChange={(e) => setNewDocumentName(e.target.value)}
              placeholder="Enter document name"
            />
          </div>

          {/* Folder Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Select Personal Folder</label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreatingFolder(!isCreatingFolder)}
                className="flex items-center gap-2"
              >
                <FolderPlus className="h-4 w-4" />
                New Folder
              </Button>
            </div>

            {/* Create New Folder */}
            {isCreatingFolder && (
              <Card className="border-dashed">
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Folder Name</label>
                    <Input
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="Enter folder name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category</label>
                    <div className="grid gap-2">
                      {categories?.map((category) => (
                        <button
                          key={category.id}
                          onClick={() => setSelectedCategoryForNewFolder(category.id)}
                          className={`p-3 rounded-lg border text-left transition-colors ${
                            selectedCategoryForNewFolder === category.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-muted"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{category.name}</span>
                            <Badge variant={category.accessLevel === "full" ? "default" : "secondary"}>
                              {category.accessLevel === "full" ? "Full Access" : "Read Only"}
                            </Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleCreateFolder}
                      disabled={createPersonalFolderMutation.isPending || !newFolderName.trim() || !selectedCategoryForNewFolder}
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Folder
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsCreatingFolder(false);
                        setNewFolderName("");
                        setSelectedCategoryForNewFolder("");
                      }}
                      size="sm"
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Existing Folders */}
            <div className="space-y-4">
              {Object.keys(foldersByCategory).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No personal folders available.</p>
                  <p className="text-sm">Create a new folder above to get started.</p>
                </div>
              ) : (
                Object.entries(foldersByCategory).map(([categoryName, folders]) => (
                  <div key={categoryName} className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">
                      {categoryName}
                    </h3>
                    <div className="grid gap-2">
                      {folders.map((folder) => (
                        <button
                          key={folder.id}
                          onClick={() => setSelectedFolderId(folder.id)}
                          className={`p-3 rounded-lg border text-left transition-colors ${
                            selectedFolderId === folder.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-muted"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Folder className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{folder.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Created {new Date(folder.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-muted/50">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCloneDocument}
            disabled={
              cloneDocumentMutation.isPending ||
              !selectedFolderId ||
              !newDocumentName.trim()
            }
          >
            {cloneDocumentMutation.isPending ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            Clone Document
          </Button>
        </div>
      </div>
    </div>
  );
}
