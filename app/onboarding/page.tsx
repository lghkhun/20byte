import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { OnboardingUnavailableState, OwnerOnboardingPage } from "@/components/onboarding/OwnerOnboardingView";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { getOwnerOnboardingStatus } from "@/server/services/onboardingService";

export default async function OnboardingPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;
  if (!session) {
    redirect("/login");
  }

  const onboardingStatus = await getOwnerOnboardingStatus(session.userId);
  if (!onboardingStatus) {
    return <OnboardingUnavailableState />;
  }

  return <OwnerOnboardingPage status={onboardingStatus} />;
}
