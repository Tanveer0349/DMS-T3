import "~/styles/globals.css";

import { Inter } from "next/font/google";
import { cookies } from "next/headers";

import { TRPCReactProvider } from "~/trpc/react";
import { SessionProviderWrapper } from "~/components/providers/session-provider";
import { ToastProvider } from "~/components/providers/toast-provider";
import { getServerAuthSession } from "~/server/auth";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata = {
  title: "Document Management System",
  description: "A modern document management system built with T3 stack",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerAuthSession();

  return (
    <html lang="en">
      <body className={`font-sans ${inter.variable}`}>
        <SessionProviderWrapper session={session}>
          <TRPCReactProvider cookies={cookies().toString()}>
            <ToastProvider>
              {children}
            </ToastProvider>
          </TRPCReactProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}