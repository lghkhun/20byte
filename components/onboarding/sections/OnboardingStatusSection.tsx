import type { OnboardingStatus } from "@/components/onboarding/types";

type OnboardingStatusSectionProps = {
  isLoadingStatus: boolean;
  onboardingStatus: OnboardingStatus | null;
};

export function OnboardingStatusSection({
  isLoadingStatus,
  onboardingStatus
}: OnboardingStatusSectionProps) {
  return (
    <div className="rounded-xl border border-border bg-surface/70 p-4">
      <h2 className="mb-3 text-sm font-semibold">Onboarding Status</h2>
      {isLoadingStatus ? (
        <p className="text-sm text-muted-foreground">Loading onboarding status...</p>
      ) : onboardingStatus ? (
        <div className="space-y-2">
          <p className="text-sm">
            Progress: <span className="font-medium">Step {onboardingStatus.currentStep}/{onboardingStatus.totalSteps}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Next step: {onboardingStatus.nextStep === "CONNECT_WHATSAPP" ? "Connect WhatsApp account" : "Onboarding completed"}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Select or create an organization to view status.</p>
      )}
    </div>
  );
}
