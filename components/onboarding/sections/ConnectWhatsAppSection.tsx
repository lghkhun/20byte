import type { FormEvent } from "react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { EmbeddedSignupContext } from "@/components/onboarding/types";

type ConnectWhatsAppSectionProps = {
  selectedOrgId: string;
  embeddedContext: EmbeddedSignupContext | null;
  isLoadingEmbedded: boolean;
  isConnectingWhatsApp: boolean;
  metaBusinessId: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhone: string;
  accessToken: string;
  onMetaBusinessIdChange: (value: string) => void;
  onWabaIdChange: (value: string) => void;
  onPhoneNumberIdChange: (value: string) => void;
  onDisplayPhoneChange: (value: string) => void;
  onAccessTokenChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function ConnectWhatsAppSection({
  selectedOrgId,
  embeddedContext,
  isLoadingEmbedded,
  isConnectingWhatsApp,
  metaBusinessId,
  wabaId,
  phoneNumberId,
  displayPhone,
  accessToken,
  onMetaBusinessIdChange,
  onWabaIdChange,
  onPhoneNumberIdChange,
  onDisplayPhoneChange,
  onAccessTokenChange,
  onSubmit
}: ConnectWhatsAppSectionProps) {
  return (
    <div className="rounded-xl border border-border bg-surface/70 p-4">
      <h2 className="mb-3 text-sm font-semibold">Connect WhatsApp (Embedded Signup)</h2>
      {isLoadingEmbedded ? (
        <p className="mb-3 text-sm text-muted-foreground">Loading embedded signup configuration...</p>
      ) : embeddedContext ? (
        <div className="mb-3 space-y-1 rounded-lg border border-border p-3 text-xs text-muted-foreground">
          <p>State: {embeddedContext.state}</p>
          <p>App ID: {embeddedContext.appId ?? "Not configured"}</p>
          <p>Config ID: {embeddedContext.configId ?? "Not configured"}</p>
          <p>Callback: {embeddedContext.callbackPath}</p>
          {embeddedContext.connectedAccount ? (
            <p>
              Connected: {embeddedContext.connectedAccount.displayPhone} ({embeddedContext.connectedAccount.phoneNumberId})
            </p>
          ) : (
            <p>Connected: none</p>
          )}
        </div>
      ) : (
        <p className="mb-3 text-sm text-muted-foreground">Select an organization to load embedded signup configuration.</p>
      )}

      <form className="space-y-3" onSubmit={onSubmit}>
        <Input value={metaBusinessId} onChange={(event) => onMetaBusinessIdChange(event.target.value)} placeholder="Meta Business ID" required />
        <Input value={wabaId} onChange={(event) => onWabaIdChange(event.target.value)} placeholder="WABA ID" required />
        <Input value={phoneNumberId} onChange={(event) => onPhoneNumberIdChange(event.target.value)} placeholder="Phone Number ID" required />
        <Input value={displayPhone} onChange={(event) => onDisplayPhoneChange(event.target.value)} placeholder="Display Phone (+628...)" required />
        <Input value={accessToken} onChange={(event) => onAccessTokenChange(event.target.value)} placeholder="Access Token" required />
        <Button type="submit" disabled={!selectedOrgId || isConnectingWhatsApp}>
          {isConnectingWhatsApp ? "Connecting..." : "Save WhatsApp Connection"}
        </Button>
      </form>
    </div>
  );
}
