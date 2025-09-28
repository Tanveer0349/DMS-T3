"use client";

import { useState } from "react";
import { Users, Shield, Eye, Edit, Trash2, Plus } from "lucide-react";
import { Layout } from "~/components/Layout";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { api } from "~/trpc/react";

export function AccessControlClient() {
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [accessLevel, setAccessLevel] = useState<"full" | "read">("read");

  // Queries
  const { data: categories } = api.admin.getCategories.useQuery();
  const { data: users } = api.admin.getAllUsers.useQuery();
  const { data: categoryAccess, refetch: refetchAccess } = api.admin.getCategoryAccess.useQuery(
    { categoryId: selectedCategory },
    { enabled: !!selectedCategory }
  );

  // Mutations
  const grantAccessMutation = api.admin.grantAccess.useMutation();
  const revokeAccessMutation = api.admin.revokeAccess.useMutation();

  const handleGrantAccess = async () => {
    if (!selectedUser || !selectedCategory) return;

    try {
      await grantAccessMutation.mutateAsync({
        userId: selectedUser,
        categoryId: selectedCategory,
        accessLevel,
      });
      await refetchAccess();
      setSelectedUser("");
      setAccessLevel("read");
    } catch (error) {
      console.error("Failed to grant access:", error);
    }
  };

  const handleRevokeAccess = async (userId: string) => {
    if (!selectedCategory) return;

    try {
      await revokeAccessMutation.mutateAsync({
        userId,
        categoryId: selectedCategory,
      });
      await refetchAccess();
    } catch (error) {
      console.error("Failed to revoke access:", error);
    }
  };

const getUserName = (userId: string) => {
  const user = users?.find((u: any) => u.id === userId);
  return user?.name || user?.email || "Unknown User";
};

  const getUserEmail = (userId: string) => {
    const user = users?.find((u: any)=> u.id === userId);
    return user?.email || "";
  };

  return (
    <Layout>
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Access Control</h1>
          <p className="text-muted-foreground">
            Manage user permissions for categories
          </p>
        </div>

        {/* Category Selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Select Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a category to manage access" />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((category: any) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedCategory && (
          <>
            {/* Grant New Access */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Grant Access
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users?.filter((user: any) => user.role === "user").map((user: any) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={accessLevel} onValueChange={(value: "full" | "read") => setAccessLevel(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="read">Read Only</SelectItem>
                      <SelectItem value="full">Full Access</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="md:col-span-2">
                    <Button 
                      onClick={handleGrantAccess}
                      disabled={!selectedUser || grantAccessMutation.isPending}
                      className="w-full"
                    >
                      {grantAccessMutation.isPending ? "Granting..." : "Grant Access"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Current Access List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Current Access ({categoryAccess?.length || 0} users)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {categoryAccess && categoryAccess.length > 0 ? (
                  <div className="space-y-4">
                    {categoryAccess.map((access: any) => (
                      <div
                        key={access.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-medium">{getUserName(access.userId)}</h3>
                            <p className="text-sm text-muted-foreground">
                              {getUserEmail(access.userId)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <Badge 
                            variant={access.accessLevel === "full" ? "default" : "secondary"}
                            className="flex items-center gap-1"
                          >
                            {access.accessLevel === "full" ? (
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

                          <div className="text-xs text-muted-foreground">
                            Granted {new Date(access.grantedAt).toLocaleDateString()}
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRevokeAccess(access.userId)}
                            disabled={revokeAccessMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No users have access to this category yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {!selectedCategory && (
          <div className="text-center py-12 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Select a category above to manage user access permissions.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}