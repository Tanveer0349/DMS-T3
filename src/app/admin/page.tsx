import { redirect } from "next/navigation";
import { getServerAuthSession } from "~/server/auth";
import { AdminDashboardClient } from "./admin-dashboard-client";

export default async function AdminDashboard() {
  const session = await getServerAuthSession();

  if (!session) {
    redirect("/auth/signin");
  }

  if (session.user.role !== "system_admin") {
    redirect("/dashboard");
  }

  return <AdminDashboardClient />;
}