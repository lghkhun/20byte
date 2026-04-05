import { cookies } from "next/headers";

import { SettingsWorkspace } from "@/components/settings/SettingsWorkspace";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { getPrimaryOrganizationForUser } from "@/server/services/organizationService";

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
  const session = token ? verifySessionToken(token) : null;
  const primaryOrg = session ? await getPrimaryOrganizationForUser(session.userId).catch(() => null) : null;
  const canAccessBusinessSettings = primaryOrg?.role === "OWNER";

  return <SettingsWorkspace initialTab={resolvedSearchParams?.tab ?? "business"} canAccessBusinessSettings={canAccessBusinessSettings} />;
}
