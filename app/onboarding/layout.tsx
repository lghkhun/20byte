import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { canAccessOrganizationSettings } from "@/lib/permissions/orgPermissions";
import { listOrganizationsForUser } from "@/server/services/organizationService";

export default async function OnboardingLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;

  if (!session) {
    redirect("/login");
  }

  const organizations = await listOrganizationsForUser(session.userId);
  if (organizations.length > 0) {
    const hasSettingsAccess = organizations.some((organization) => canAccessOrganizationSettings(organization.role));
    if (!hasSettingsAccess) {
      redirect("/dashboard");
    }
  }

  return <>{children}</>;
}
