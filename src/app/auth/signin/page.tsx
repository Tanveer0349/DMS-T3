import { redirect } from "next/navigation";
import { getServerAuthSession } from "~/server/auth";
import { SignInForm } from "./signin-form";

export default async function SignInPage() {
  const session = await getServerAuthSession();

  if (session) {
    if (session.user.role === "system_admin") {
      redirect("/admin");
    } else {
      redirect("/dashboard");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <SignInForm />
    </div>
  );
}