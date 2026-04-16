import { cookies } from "next/headers";

import { ACTIVE_ORG_COOKIE_NAME } from "@/lib/auth/activeOrg";
import { SettingsWorkspace } from "@/components/settings/SettingsWorkspace";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { getActiveOrganizationForUser } from "@/server/services/organizationService";

export default async function SettingsPage({
  searchParams
}: {
  searchParams?: Promise<{
    tab?: string;
  }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const activeOrgIdCookie = cookieStore.get(ACTIVE_ORG_COOKIE_NAME)?.value?.trim() ?? "";
  const session = token ? verifySessionToken(token) : null;
  const primaryOrg = session ? await getActiveOrganizationForUser(session.userId, activeOrgIdCookie).catch(() => null) : null;
  const canAccessBusinessSettings = primaryOrg?.role === "OWNER";

  return <SettingsWorkspace initialTab={resolvedSearchParams?.tab ?? "business"} canAccessBusinessSettings={canAccessBusinessSettings} />;
}
