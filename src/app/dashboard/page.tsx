import { redirect } from "next/navigation";
import { getServerAuthSession } from "~/server/auth";
import { UserDashboardClient } from "./user-dashboard-client";

export default async function Dashboard() {
  const session = await getServerAuthSession();

  if (!session) {
    redirect("/auth/signin");
  }

  if (session.user.role === "system_admin") {
    redirect("/admin");
  }

  return <UserDashboardClient />;
}