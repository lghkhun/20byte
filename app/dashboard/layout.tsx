import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

export default async function DashboardLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;

  if (!session) {
    redirect("/login");
  }

  return <>{children}</>;
}
