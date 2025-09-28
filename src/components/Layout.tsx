"use client";

import React, { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  FolderOpen, 
  Settings, 
  LogOut, 
  User,
  FileText,
  Menu,
  X
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!session) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  const isAdmin = session.user.role === "system_admin";
  
  const navigation = [
    {
      name: "Dashboard",
      href: isAdmin ? "/admin" : "/dashboard",
      icon: LayoutDashboard,
      current: pathname === (isAdmin ? "/admin" : "/dashboard"),
    },
    ...(isAdmin
      ? [
          {
            name: "Categories",
            href: "/admin/categories",
            icon: FolderOpen,
            current: pathname.startsWith("/admin/categories"),
          },
          {
            name: "Users",
            href: "/admin/users",
            icon: User,
            current: pathname.startsWith("/admin/users"),
          },
          {
            name: "Access Control",
            href: "/admin/access",
            icon: Settings,
            current: pathname.startsWith("/admin/access"),
          },
        ]
      : [
          {
            name: "My Library",
            href: "/library",
            icon: FileText,
            current: pathname.startsWith("/library"),
          },
        ]),
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen">
        {/* Mobile menu overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col w-64 bg-card border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex items-center justify-between h-16 px-4 border-b">
            <h1 className="text-lg font-semibold">Document MS</h1>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center px-3 py-3 rounded-md text-sm font-medium transition-colors",
                    item.current
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          
          <div className="p-4 border-t">
            <div className="flex items-center space-x-3 mb-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {session.user.name || session.user.email}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {session.user.role.replace("_", " ")}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut()}
              className="w-full justify-start"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
        
        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile header */}
          <div className="flex items-center justify-between h-16 px-4 border-b bg-background lg:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">Document MS</h1>
            <div className="w-10" /> {/* Spacer for centering */}
          </div>

          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}