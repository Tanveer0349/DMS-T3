import { redirect } from "next/navigation";
import { getServerAuthSession } from "~/server/auth";
import { LibraryClient } from "./library-client";

export default async function LibraryPage() {
  const session = await getServerAuthSession();

  if (!session) {
    redirect("/auth/signin");
  }

  if (session.user.role === "system_admin") {
    redirect("/admin");
  }

  return <LibraryClient />;
}