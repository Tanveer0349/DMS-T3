import { redirect } from "next/navigation";
import { getServerAuthSession } from "~/server/auth";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  const session = await getServerAuthSession();

  if (!session) {
    redirect("/auth/signin");
  }

  if (session.user.role !== "system_admin") {
    redirect("/dashboard");
  }

  return <UsersClient />;
}