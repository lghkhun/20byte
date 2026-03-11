import type { FormEvent } from "react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type TestMessageSectionProps = {
  selectedOrgId: string;
  testPhoneE164: string;
  isSendingTestMessage: boolean;
  onTestPhoneChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function TestMessageSection({
  selectedOrgId,
  testPhoneE164,
  isSendingTestMessage,
  onTestPhoneChange,
  onSubmit
}: TestMessageSectionProps) {
  return (
    <div className="rounded-xl border border-border bg-surface/70 p-4">
      <h2 className="mb-3 text-sm font-semibold">Verification Test Message</h2>
      <form className="space-y-3" onSubmit={onSubmit}>
        <Input
          value={testPhoneE164}
          onChange={(event) => onTestPhoneChange(event.target.value)}
          placeholder="Target phone in E.164 format (+628...)"
          required
        />
        <Button type="submit" disabled={!selectedOrgId || isSendingTestMessage}>
          {isSendingTestMessage ? "Sending..." : "Send Test Message"}
        </Button>
      </form>
    </div>
  );
}
