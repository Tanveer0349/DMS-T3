"use client";

import { useState } from "react";
import { Users, Plus, Trash2, UserPlus, Shield, Eye } from "lucide-react";
import { Layout } from "~/components/Layout";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { useToast } from "~/components/providers/toast-provider";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/react";

type User = RouterOutputs["admin"]["getAllUsers"][0];

export function UsersClient() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "user" as "system_admin" | "user"
  });
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const { addToast } = useToast();

  // Queries
  const { data: users, refetch: refetchUsers } = api.admin.getAllUsers.useQuery();

  // Mutations
  const createUserMutation = api.admin.createUser.useMutation();
  const deleteUserMutation = api.admin.deleteUser.useMutation();

  const handleCreateUser = async () => {
    if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password.trim()) {
      addToast({
        type: "warning",
        title: "Missing information",
        description: "Please fill in all required fields.",
      });
      return;
    }

    try {
      await createUserMutation.mutateAsync(newUser);
      
      setNewUser({ name: "", email: "", password: "", role: "user" });
      setShowCreateForm(false);
      await refetchUsers();
      
      addToast({
        type: "success",
        title: "User created",
        description: `User "${newUser.name}" has been created successfully.`,
      });
    } catch (error: any) {
      addToast({
        type: "error",
        title: "Creation failed",
        description: error.message || "Failed to create user. Please try again.",
      });
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    setDeletingUserId(userId);
    try {
      await deleteUserMutation.mutateAsync({ id: userId });
      await refetchUsers();
      
      addToast({
        type: "success",
        title: "User deleted",
        description: `User "${userName}" has been deleted successfully.`,
      });
    } catch (error: any) {
      addToast({
        type: "error",
        title: "Delete failed",
        description: error.message || "Failed to delete user. Please try again.",
      });
    } finally {
      setDeletingUserId(null);
    }
  };

  const regularUsers = users?.filter((user: User) => user.role === "user") || [];
  const adminUsers = users?.filter((user: User) => user.role === "system_admin") || [];

  return (
    <Layout>
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">User Management</h1>
          <p className="text-muted-foreground">
            Create and manage system users
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card p-6 rounded-lg border">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Total Users
                </p>
                <p className="text-2xl font-bold">{users?.length || 0}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-card p-6 rounded-lg border">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Administrators
                </p>
                <p className="text-2xl font-bold">{adminUsers.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-card p-6 rounded-lg border">
            <div className="flex items-center">
              <Eye className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Regular Users
                </p>
                <p className="text-2xl font-bold">{regularUsers.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Create User Form */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Create New User
              </CardTitle>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateForm(!showCreateForm);
                  if (showCreateForm) {
                    setNewUser({ name: "", email: "", password: "", role: "user" });
                  }
                }}
              >
                {showCreateForm ? "Cancel" : "Add User"}
              </Button>
            </div>
          </CardHeader>
          {showCreateForm && (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Name</label>
                  <Input
                    placeholder="Full name"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Password</label>
                  <Input
                    type="password"
                    placeholder="Min 6 characters"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Role</label>
                  <Select
                    value={newUser.role}
                    onValueChange={(value: "system_admin" | "user") => 
                      setNewUser({ ...newUser, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Regular User</SelectItem>
                      <SelectItem value="system_admin">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                onClick={handleCreateUser}
                disabled={createUserMutation.isPending}
                className="w-full"
              >
                {createUserMutation.isPending ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Create User
              </Button>
            </CardContent>
          )}
        </Card>

        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              All Users ({users?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {users && users.length > 0 ? (
              <div className="space-y-4">
                {users.map((user: User) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        {user.role === "system_admin" ? (
                          <Shield className="h-5 w-5 text-primary" />
                        ) : (
                          <Users className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium">{user.name || user.email}</h3>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <Badge 
                        variant={user.role === "system_admin" ? "default" : "secondary"}
                      >
                        {user.role === "system_admin" ? "Admin" : "User"}
                      </Badge>

                      <div className="text-xs text-muted-foreground">
                        Joined {new Date(user.createdAt).toLocaleDateString()}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteUser(user.id, user.name || user.email)}
                        disabled={deletingUserId === user.id}
                        className="text-destructive hover:text-destructive"
                      >
                        {deletingUserId === user.id ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No users found.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}