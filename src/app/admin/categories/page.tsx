import { redirect } from "next/navigation";
import { getServerAuthSession } from "~/server/auth";
import { CategoriesClient } from "./categories-client";

export default async function CategoriesPage() {
  const session = await getServerAuthSession();

  if (!session) {
    redirect("/auth/signin");
  }

  if (session.user.role !== "system_admin") {
    redirect("/dashboard");
  }

  return <CategoriesClient />;
}  