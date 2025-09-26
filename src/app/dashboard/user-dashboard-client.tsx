"use client";

import { useRouter } from "next/navigation";
import { FolderOpen, FileText, Eye, Edit } from "lucide-react";
import { Layout } from "~/components/Layout";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

export function UserDashboardClient() {
  const router = useRouter();
  
  const { data: categories } = api.user.getAccessibleCategories.useQuery();

  return (
    <Layout>
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">My Dashboard</h1>
          <p className="text-muted-foreground">
            Access your documents and manage your personal library
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-card p-6 rounded-lg border">
            <div className="flex items-center">
              <FolderOpen className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Accessible Categories
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
                  Recent Documents
                </p>
                <p className="text-2xl font-bold">-</p>
              </div>
            </div>
          </div> */}
        </div>

        {/* Accessible Categories */}
        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Your Categories</h2>
            <Button
              onClick={() => router.push("/library")}
              variant="outline"
            >
              View All
            </Button>
          </div>

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
                      Access Level: {category.accessLevel === "full" ? (
                        <span className="text-green-600 font-medium">Full Access</span>
                      ) : (
                        <span className="text-blue-600 font-medium">Read Only</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/library/${category.id}`)}
                  >
                    {category.accessLevel === "full" ? (
                      <>
                        <Edit className="h-4 w-4 mr-2" />
                        Manage
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
            
            {categories?.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No categories assigned yet. Contact your administrator for access.
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}