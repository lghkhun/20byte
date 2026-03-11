import { Button } from "@/components/ui/button";

type OnboardingCompletionSectionProps = {
  isCompleted: boolean;
  onGoToInbox: () => void;
};

export function OnboardingCompletionSection({
  isCompleted,
  onGoToInbox
}: OnboardingCompletionSectionProps) {
  if (!isCompleted) {
    return null;
  }

  return (
    <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
      <p className="text-sm text-emerald-300">Onboarding completed. Continue to inbox workspace.</p>
      <Button className="mt-3" onClick={onGoToInbox}>
        Go to Inbox
      </Button>
    </div>
  );
}
