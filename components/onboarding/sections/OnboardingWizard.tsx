export function OnboardingWizard() {
  return (
    <div className="rounded-xl border border-border bg-surface/70 p-4">
      <h2 className="mb-3 text-sm font-semibold">Onboarding Wizard</h2>
      <div className="grid gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Step 1</p>
          <p className="text-sm font-medium text-foreground">Create Organization</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Step 2</p>
          <p className="text-sm font-medium text-foreground">Connect WhatsApp</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Step 3</p>
          <p className="text-sm font-medium text-foreground">Send Test Message</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Step 4</p>
          <p className="text-sm font-medium text-foreground">Go to Inbox</p>
        </div>
      </div>
    </div>
  );
}
