import { redirect } from "next/navigation";
import { getServerAuthSession } from "~/server/auth";
import { AccessControlClient } from "./access-control-client";

export default async function AccessControlPage() {
  const session = await getServerAuthSession();

  if (!session) {
    redirect("/auth/signin");
  }

  if (session.user.role !== "system_admin") {
    redirect("/dashboard");
  }

  return <AccessControlClient />;
}