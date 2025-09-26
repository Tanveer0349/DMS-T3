"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FolderOpen, FileText, Users, Plus } from "lucide-react";
import { Layout } from "~/components/Layout";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";

export function AdminDashboardClient() {
  const router = useRouter();
  const [newCategoryName, setNewCategoryName] = useState("");

  const { data: categories, refetch: refetchCategories } = api.admin.getCategories.useQuery();
  const createCategoryMutation = api.admin.createCategory.useMutation();

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

  return (
    <Layout>
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Manage categories, folders, documents, and user access
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card p-6 rounded-lg border">
            <div className="flex items-center">
              <FolderOpen className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Categories
                </p>
                <p className="text-2xl font-bold">{categories?.length || 0}</p>
              </div>
            </div>
          </div>
          
          {/* <div className="bg-card p-6 rounded-lg border">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Total Documents
                </p>
                <p className="text-2xl font-bold">-</p>
              </div>
            </div>
          </div>
          
          <div className="bg-card p-6 rounded-lg border">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Active Users
                </p>
                <p className="text-2xl font-bold">-</p>
              </div>
            </div>
          </div> */}
        </div>

        {/* Categories Management */}
        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Categories</h2>
          </div>
          
          {/* Create New Category */}
          <div className="flex gap-2 mb-6">
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

          {/* Categories List */}
          <div className="space-y-4">
            {categories?.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <FolderOpen className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <h3 className="font-medium">{category.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Created {new Date(category.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/admin/categories/${category.id}`)}
                  >
                    Manage
                  </Button>
                </div>
              </div>
            ))}
            
            {categories?.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No categories yet. Create your first category above.
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}