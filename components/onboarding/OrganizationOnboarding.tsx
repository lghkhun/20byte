"use client";

import { FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type OrganizationSummary = {
  id: string;
  name: string;
  role: string;
  createdAt: string;
};

type OnboardingStatus = {
  orgId: string;
  orgName: string;
  isCompleted: boolean;
  currentStep: number;
  totalSteps: number;
  nextStep: "CONNECT_WHATSAPP" | "DONE";
};

type OrganizationsResponse = {
  data?: {
    organizations?: OrganizationSummary[];
  };
  error?: {
    message?: string;
  };
};

type OnboardingResponse = {
  data?: {
    onboarding?: OnboardingStatus;
  };
  error?: {
    message?: string;
  };
};

type CreateOrganizationResponse = {
  data?: {
    organization?: OrganizationSummary;
  };
  error?: {
    message?: string;
  };
};

type EmbeddedSignupContext = {
  orgId: string;
  appId: string | null;
  configId: string | null;
  callbackPath: string;
  state: string;
  connectedAccount: {
    id: string;
    displayPhone: string;
    phoneNumberId: string;
    connectedAt: string;
  } | null;
};

type EmbeddedSignupResponse = {
  data?: {
    embeddedSignup?: EmbeddedSignupContext;
  };
  error?: {
    message?: string;
  };
};

type ConnectWhatsAppResponse = {
  data?: {
    waAccount?: {
      id: string;
      phoneNumberId: string;
      displayPhone: string;
      connectedAt: string;
    };
  };
  error?: {
    message?: string;
  };
};

function defaultStatus(): OnboardingStatus | null {
  return null;
}

export function OrganizationOnboarding() {
  const [orgName, setOrgName] = useState("");
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(defaultStatus());
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isLoadingEmbedded, setIsLoadingEmbedded] = useState(false);
  const [isConnectingWhatsApp, setIsConnectingWhatsApp] = useState(false);
  const [embeddedContext, setEmbeddedContext] = useState<EmbeddedSignupContext | null>(null);
  const [metaBusinessId, setMetaBusinessId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [displayPhone, setDisplayPhone] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const selectedOrganization = useMemo(
    () => organizations.find((organization) => organization.id === selectedOrgId) ?? null,
    [organizations, selectedOrgId]
  );

  async function loadOrganizations() {
    setIsLoadingOrgs(true);
    setError(null);
    setInfo(null);

    try {
      const response = await fetch("/api/orgs", { method: "GET" });
      const payload = (await response.json().catch(() => null)) as OrganizationsResponse | null;
      if (!response.ok) {
        setError(payload?.error?.message ?? "Failed to fetch organizations.");
        return;
      }

      const fetchedOrganizations = payload?.data?.organizations ?? [];
      setOrganizations(fetchedOrganizations);
      if (fetchedOrganizations.length > 0) {
        const nextOrgId = selectedOrgId || fetchedOrganizations[0].id;
        setSelectedOrgId(nextOrgId);
        await loadOnboardingStatus(nextOrgId);
        await loadEmbeddedSignupContext(nextOrgId);
      } else {
        setSelectedOrgId("");
        setOnboardingStatus(defaultStatus());
        setEmbeddedContext(null);
      }
    } catch {
      setError("Network error while loading organizations.");
    } finally {
      setIsLoadingOrgs(false);
    }
  }

  async function loadEmbeddedSignupContext(orgId: string) {
    if (!orgId) {
      return;
    }

    setIsLoadingEmbedded(true);
    setError(null);

    try {
      const response = await fetch(`/api/whatsapp/embedded-signup?orgId=${encodeURIComponent(orgId)}`, {
        method: "GET"
      });
      const payload = (await response.json().catch(() => null)) as EmbeddedSignupResponse | null;
      if (!response.ok) {
        setError(payload?.error?.message ?? "Failed to load WhatsApp embedded signup context.");
        return;
      }

      setEmbeddedContext(payload?.data?.embeddedSignup ?? null);
    } catch {
      setError("Network error while loading WhatsApp embedded signup context.");
    } finally {
      setIsLoadingEmbedded(false);
    }
  }

  async function handleConnectWhatsApp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrgId) {
      setError("Select an organization first.");
      return;
    }

    setIsConnectingWhatsApp(true);
    setError(null);
    setInfo(null);

    try {
      const response = await fetch("/api/whatsapp/embedded-signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orgId: selectedOrgId,
          metaBusinessId,
          wabaId,
          phoneNumberId,
          displayPhone,
          accessToken
        })
      });

      const payload = (await response.json().catch(() => null)) as ConnectWhatsAppResponse | null;
      if (!response.ok) {
        setError(payload?.error?.message ?? "Failed to connect WhatsApp.");
        return;
      }

      setInfo("WhatsApp account connected.");
      setAccessToken("");
      await loadEmbeddedSignupContext(selectedOrgId);
      await loadOnboardingStatus(selectedOrgId);
    } catch {
      setError("Network error while connecting WhatsApp account.");
    } finally {
      setIsConnectingWhatsApp(false);
    }
  }

  async function loadOnboardingStatus(orgId: string) {
    if (!orgId) {
      return;
    }

    setIsLoadingStatus(true);
    setError(null);

    try {
      const response = await fetch(`/api/orgs/onboarding?orgId=${encodeURIComponent(orgId)}`, {
        method: "GET"
      });
      const payload = (await response.json().catch(() => null)) as OnboardingResponse | null;
      if (!response.ok) {
        setError(payload?.error?.message ?? "Failed to fetch onboarding status.");
        return;
      }

      setOnboardingStatus(payload?.data?.onboarding ?? null);
    } catch {
      setError("Network error while loading onboarding status.");
    } finally {
      setIsLoadingStatus(false);
    }
  }

  async function handleCreateOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setIsCreatingOrg(true);

    try {
      const response = await fetch("/api/orgs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: orgName
        })
      });

      const payload = (await response.json().catch(() => null)) as CreateOrganizationResponse | null;
      if (!response.ok) {
        setError(payload?.error?.message ?? "Failed to create organization.");
        return;
      }

      const createdOrganization = payload?.data?.organization;
      if (!createdOrganization) {
        setError("Invalid response from server.");
        return;
      }

      const nextOrganizations = [...organizations, createdOrganization];
      setOrganizations(nextOrganizations);
      setSelectedOrgId(createdOrganization.id);
      setOrgName("");
      setInfo("Organization created.");
      await loadOnboardingStatus(createdOrganization.id);
    } catch {
      setError("Network error while creating organization.");
    } finally {
      setIsCreatingOrg(false);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Organization Onboarding</h1>
        <p className="text-sm text-muted-foreground">
          Create your organization first, then continue to WhatsApp connection.
        </p>
      </header>

      <div className="rounded-xl border border-border bg-surface/70 p-4">
        <form className="space-y-4" onSubmit={handleCreateOrganization}>
          <div className="space-y-2">
            <label htmlFor="org-name" className="text-sm font-medium">
              Organization name
            </label>
            <Input
              id="org-name"
              name="org-name"
              value={orgName}
              onChange={(event) => setOrgName(event.target.value)}
              placeholder="20byte Studio"
              required
            />
          </div>
          <Button type="submit" disabled={isCreatingOrg}>
            {isCreatingOrg ? "Creating..." : "Create organization"}
          </Button>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-surface/70 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Your Organizations</h2>
          <Button variant="secondary" size="sm" type="button" onClick={loadOrganizations} disabled={isLoadingOrgs}>
            {isLoadingOrgs ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {organizations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No organizations yet. Create one to start onboarding.
          </p>
        ) : (
          <div className="space-y-3">
            <select
              className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm"
              value={selectedOrgId}
              onChange={(event) => {
                const nextOrgId = event.target.value;
                setSelectedOrgId(nextOrgId);
                void loadOnboardingStatus(nextOrgId);
                void loadEmbeddedSignupContext(nextOrgId);
              }}
            >
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name} ({organization.role})
                </option>
              ))}
            </select>

            {selectedOrganization ? (
              <div className="rounded-lg border border-border p-3">
                <p className="text-sm text-foreground">
                  Selected: <span className="font-medium">{selectedOrganization.name}</span>
                </p>
                <p className="text-xs text-muted-foreground">Role: {selectedOrganization.role}</p>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface/70 p-4">
        <h2 className="mb-3 text-sm font-semibold">Onboarding Status</h2>
        {isLoadingStatus ? (
          <p className="text-sm text-muted-foreground">Loading onboarding status...</p>
        ) : onboardingStatus ? (
          <div className="space-y-2">
            <p className="text-sm">
              Progress:{" "}
              <span className="font-medium">
                Step {onboardingStatus.currentStep}/{onboardingStatus.totalSteps}
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              Next step:{" "}
              {onboardingStatus.nextStep === "CONNECT_WHATSAPP"
                ? "Connect WhatsApp account"
                : "Onboarding completed"}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Select or create an organization to view status.</p>
        )}
      </div>

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
          <p className="mb-3 text-sm text-muted-foreground">
            Select an organization to load embedded signup configuration.
          </p>
        )}

        <form className="space-y-3" onSubmit={handleConnectWhatsApp}>
          <Input
            value={metaBusinessId}
            onChange={(event) => setMetaBusinessId(event.target.value)}
            placeholder="Meta Business ID"
            required
          />
          <Input value={wabaId} onChange={(event) => setWabaId(event.target.value)} placeholder="WABA ID" required />
          <Input
            value={phoneNumberId}
            onChange={(event) => setPhoneNumberId(event.target.value)}
            placeholder="Phone Number ID"
            required
          />
          <Input
            value={displayPhone}
            onChange={(event) => setDisplayPhone(event.target.value)}
            placeholder="Display Phone (+628...)"
            required
          />
          <Input
            value={accessToken}
            onChange={(event) => setAccessToken(event.target.value)}
            placeholder="Access Token"
            required
          />
          <Button type="submit" disabled={!selectedOrgId || isConnectingWhatsApp}>
            {isConnectingWhatsApp ? "Connecting..." : "Save WhatsApp Connection"}
          </Button>
        </form>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {info ? <p className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">{info}</p> : null}
    </section>
  );
}
