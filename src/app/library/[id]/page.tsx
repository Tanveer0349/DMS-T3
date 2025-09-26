import { redirect } from "next/navigation";
import { getServerAuthSession } from "~/server/auth";
import { LibraryCategoryClient } from "./library-category-client";

interface LibraryCategoryPageProps {
  params: {
    id: string;
  };
}

export default async function LibraryCategoryPage({ params }: LibraryCategoryPageProps) {
  const session = await getServerAuthSession();

  if (!session) {
    redirect("/auth/signin");
  }

  if (session.user.role === "system_admin") {
    redirect("/admin");
  }

  return <LibraryCategoryClient categoryId={params.id} />;
}