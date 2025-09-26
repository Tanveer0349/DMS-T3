"use client";

import { useRouter } from "next/navigation";
import { FolderOpen, Eye, Edit, Lock } from "lucide-react";
import { Layout } from "~/components/Layout";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";

export function LibraryClient() {
  const router = useRouter();
  
  const { data: categories } = api.user.getAccessibleCategories.useQuery();

  return (
    <Layout>
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">My Library</h1>
          <p className="text-muted-foreground">
            Access your assigned categories and manage your documents
          </p>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories?.map((category) => (
            <Card key={category.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FolderOpen className="h-5 w-5" />
                    {category.name}
                  </CardTitle>
                  <Badge 
                    variant={category.accessLevel === "full" ? "default" : "secondary"}
                    className="flex items-center gap-1"
                  >
                    {category.accessLevel === "full" ? (
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
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Created {new Date(category.createdAt).toLocaleDateString()}
                  </p>
                  
                  <div className="flex items-center gap-2 text-sm">
                    {category.accessLevel === "full" ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <Edit className="h-3 w-3" />
                        You can create, edit, and delete documents
                      </span>
                    ) : (
                      <span className="text-blue-600 flex items-center gap-1">
                        <Lock className="h-3 w-3" />
                        You can only view documents
                      </span>
                    )}
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => router.push(`/library/${category.id}`)}
                  >
                    {category.accessLevel === "full" ? "Manage" : "View"} Category
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {categories?.length === 0 && (
          <div className="text-center py-12">
            <FolderOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Categories Assigned</h3>
            <p className="text-muted-foreground mb-4">
              You don't have access to any categories yet. Contact your administrator to get access.
            </p>
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              Back to Dashboard
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}