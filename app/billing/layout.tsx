import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { getPrimaryOrganizationForUser } from "@/server/services/organizationService";

export default async function BillingLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;

  if (!session) {
    redirect("/login");
  }

  const primaryOrg = await getPrimaryOrganizationForUser(session.userId).catch(() => null);
  if (!primaryOrg || primaryOrg.role !== "OWNER") {
    redirect("/inbox");
  }

  return <>{children}</>;
}
