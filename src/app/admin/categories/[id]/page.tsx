import { redirect } from "next/navigation";
import { getServerAuthSession } from "~/server/auth";
import { CategoryDetailClient } from "./category-detail-client";

interface CategoryDetailPageProps {
  params: {
    id: string;
  };
}

export default async function CategoryDetailPage({ params }: CategoryDetailPageProps) {
  const session = await getServerAuthSession();

  if (!session) {
    redirect("/auth/signin");
  }

  if (session.user.role !== "system_admin") {
    redirect("/dashboard");
  }

  return <CategoryDetailClient categoryId={params.id} />;
}