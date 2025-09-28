"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, Plus, Edit, Trash2, Users } from "lucide-react";
import { Layout } from "~/components/Layout";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/react";

type Category = RouterOutputs["admin"]["getCategories"][0];

export function CategoriesClient() {
  const router = useRouter();
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<{ id: string; name: string } | null>(null);

  // Queries
  const { data: categories, refetch: refetchCategories } = api.admin.getCategories.useQuery();

  // Mutations
  const createCategoryMutation = api.admin.createCategory.useMutation();
  const updateCategoryMutation = api.admin.updateCategory.useMutation();
  const deleteCategoryMutation = api.admin.deleteCategory.useMutation();

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    
    try {
      await createCategoryMutation.mutateAsync({
        name: newCategoryName.trim(),
      });
      setNewCategoryName("");
      await refetchCategories();
    } catch (error) {
      console.error("Failed to create category:", error);
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !editingCategory.name.trim()) return;
    
    try {
      await updateCategoryMutation.mutateAsync({
        id: editingCategory.id,
        name: editingCategory.name.trim(),
      });
      setEditingCategory(null);
      await refetchCategories();
    } catch (error) {
      console.error("Failed to update category:", error);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category? This will also delete all folders and documents within it.")) {
      return;
    }
    
    try {
      await deleteCategoryMutation.mutateAsync({ id });
      await refetchCategories();
    } catch (error) {
      console.error("Failed to delete category:", error);
    }
  };

  return (
    <Layout>
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Categories Management</h1>
          <p className="text-muted-foreground">
            Create and manage document categories
          </p>
        </div>

        {/* Create New Category */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create New Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Category name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void handleCreateCategory();
                  }
                }}
              />
              <Button 
                onClick={handleCreateCategory}
                disabled={!newCategoryName.trim() || createCategoryMutation.isPending}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Categories List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              All Categories ({categories?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {categories && categories.length > 0 ? (
              <div className="space-y-4">
                {categories.map((category: Category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <FolderOpen className="h-5 w-5 text-muted-foreground" />
                      <div>
                        {editingCategory?.id === category.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editingCategory?.name || ""}
                              onChange={(e) => setEditingCategory(editingCategory ? {
                                ...editingCategory,
                                name: e.target.value
                              } : null)}
                              className="h-8 w-48"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  void handleUpdateCategory();
                                } else if (e.key === "Escape") {
                                  setEditingCategory(null);
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              onClick={handleUpdateCategory}
                              disabled={updateCategoryMutation.isPending}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingCategory(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <>
                            <h3 className="font-medium">{category.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              Created {new Date(category.createdAt).toLocaleDateString()}
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3">
                      <Badge variant="secondary" className="mb-2 sm:mb-0 w-fit">
                        <Users className="h-3 w-3 mr-1" />
                        Category
                      </Badge>

                      <div className="flex flex-wrap gap-2">
                        {editingCategory?.id !== category.id && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingCategory({ id: category.id, name: category.name })}
                              className="flex-shrink-0"
                            >
                              <Edit className="h-4 w-4 sm:mr-2" />
                              <span className="hidden sm:inline">Edit</span>
                            </Button>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/admin/categories/${category.id}`)}
                              className="flex-shrink-0"
                            >
                              <FolderOpen className="h-4 w-4 sm:mr-2" />
                              <span className="hidden sm:inline">Manage</span>
                            </Button>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteCategory(category.id)}
                              disabled={deleteCategoryMutation.isPending}
                              className="flex-shrink-0 text-destructive hover:text-destructive"
                            >
                              {deleteCategoryMutation.isPending ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              ) : (
                                <>
                                  <Trash2 className="h-4 w-4 sm:mr-2" />
                                  <span className="hidden sm:inline">Delete</span>
                                </>
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No categories yet. Create your first category above.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}