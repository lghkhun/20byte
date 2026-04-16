import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ACTIVE_ORG_COOKIE_NAME } from "@/lib/auth/activeOrg";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { getActiveOrganizationForUser } from "@/server/services/organizationService";

export default async function BillingLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const activeOrgIdCookie = cookieStore.get(ACTIVE_ORG_COOKIE_NAME)?.value?.trim() ?? "";
  const session = token ? verifySessionToken(token) : null;

  if (!session) {
    redirect("/login");
  }

  const primaryOrg = await getActiveOrganizationForUser(session.userId, activeOrgIdCookie).catch(() => null);
  if (!primaryOrg || primaryOrg.role !== "OWNER") {
    redirect("/inbox");
  }

  return <>{children}</>;
}
