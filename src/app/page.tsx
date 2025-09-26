import { redirect } from "next/navigation";
import { getServerAuthSession } from "~/server/auth";

export default async function Home() {
  const session = await getServerAuthSession();

  if (!session) {
    redirect("/auth/signin");
  }

  if (session.user.role === "system_admin") {
    redirect("/admin");
  } else {
    redirect("/dashboard");
  }
}