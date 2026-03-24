import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { isSuperadmin } from "@/server/services/platformAccessService";

export default async function SuperadminLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;

  if (!session) {
    redirect("/login");
  }

  const allowed = await isSuperadmin(session.userId, session.email).catch(() => false);
  if (!allowed) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
