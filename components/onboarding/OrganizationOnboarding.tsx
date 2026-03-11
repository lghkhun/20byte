"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ConnectWhatsAppSection } from "@/components/onboarding/sections/ConnectWhatsAppSection";
import { CreateOrganizationSection } from "@/components/onboarding/sections/CreateOrganizationSection";
import { OnboardingCompletionSection } from "@/components/onboarding/sections/OnboardingCompletionSection";
import { OnboardingStatusSection } from "@/components/onboarding/sections/OnboardingStatusSection";
import { OnboardingWizard } from "@/components/onboarding/sections/OnboardingWizard";
import { OrganizationsSection } from "@/components/onboarding/sections/OrganizationsSection";
import { TestMessageSection } from "@/components/onboarding/sections/TestMessageSection";
import type {
  ConnectWhatsAppResponse,
  CreateOrganizationResponse,
  EmbeddedSignupContext,
  EmbeddedSignupResponse,
  OnboardingResponse,
  OnboardingStatus,
  OrganizationsResponse,
  OrganizationSummary,
  VerifyTestMessageResponse
} from "@/components/onboarding/types";

function defaultStatus(): OnboardingStatus | null {
  return null;
}

export function OrganizationOnboarding() {
  const router = useRouter();
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
  const [testPhoneE164, setTestPhoneE164] = useState("");
  const [isSendingTestMessage, setIsSendingTestMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const selectedOrganization = useMemo(
    () => organizations.find((organization) => organization.id === selectedOrgId) ?? null,
    [organizations, selectedOrgId]
  );

  useEffect(() => {
    if (!onboardingStatus?.isCompleted) {
      return;
    }

    const timer = setTimeout(() => {
      router.push("/dashboard");
    }, 1200);

    return () => {
      clearTimeout(timer);
    };
  }, [onboardingStatus?.isCompleted, router]);

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
        return;
      }

      setSelectedOrgId("");
      setOnboardingStatus(defaultStatus());
      setEmbeddedContext(null);
    } catch {
      setError("Network error while loading organizations.");
    } finally {
      setIsLoadingOrgs(false);
    }
  }

  async function handleSelectOrg(nextOrgId: string) {
    setSelectedOrgId(nextOrgId);
    await loadOnboardingStatus(nextOrgId);
    await loadEmbeddedSignupContext(nextOrgId);
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

      setOrganizations([...organizations, createdOrganization]);
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

      const webhookVerified = payload?.data?.waAccount?.postConnect?.webhookVerified ?? false;
      const testEventTriggered = payload?.data?.waAccount?.postConnect?.testEventTriggered ?? false;
      setInfo(
        `WhatsApp account connected. Webhook verified: ${webhookVerified ? "yes" : "no"}. Test event triggered: ${
          testEventTriggered ? "yes" : "no"
        }.`
      );
      setAccessToken("");
      if (!testPhoneE164) {
        setTestPhoneE164(displayPhone.trim());
      }

      await loadEmbeddedSignupContext(selectedOrgId);
      await loadOnboardingStatus(selectedOrgId);
    } catch {
      setError("Network error while connecting WhatsApp account.");
    } finally {
      setIsConnectingWhatsApp(false);
    }
  }

  async function handleSendTestMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrgId || !testPhoneE164.trim()) {
      setError("Select organization and enter verification phone number.");
      return;
    }

    setIsSendingTestMessage(true);
    setError(null);
    setInfo(null);
    try {
      const response = await fetch("/api/whatsapp/test-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orgId: selectedOrgId,
          toPhoneE164: testPhoneE164.trim()
        })
      });

      const payload = (await response.json().catch(() => null)) as VerifyTestMessageResponse | null;
      if (!response.ok) {
        setError(payload?.error?.message ?? "Failed to send verification test message.");
        return;
      }

      const waMessageId = payload?.data?.verification?.waMessageId;
      setInfo(waMessageId ? `Test message sent (id: ${waMessageId}).` : "Test message sent.");
    } catch {
      setError("Network error while sending verification test message.");
    } finally {
      setIsSendingTestMessage(false);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Organization Onboarding</h1>
        <p className="text-sm text-muted-foreground">Create your organization first, then continue to WhatsApp connection.</p>
      </header>

      <OnboardingWizard />
      <CreateOrganizationSection
        orgName={orgName}
        isCreatingOrg={isCreatingOrg}
        onOrgNameChange={setOrgName}
        onSubmit={handleCreateOrganization}
      />
      <OrganizationsSection
        organizations={organizations}
        selectedOrgId={selectedOrgId}
        selectedOrganization={selectedOrganization}
        isLoadingOrgs={isLoadingOrgs}
        onRefresh={() => {
          void loadOrganizations();
        }}
        onSelectOrg={(orgId) => {
          void handleSelectOrg(orgId);
        }}
      />
      <OnboardingStatusSection isLoadingStatus={isLoadingStatus} onboardingStatus={onboardingStatus} />
      <ConnectWhatsAppSection
        selectedOrgId={selectedOrgId}
        embeddedContext={embeddedContext}
        isLoadingEmbedded={isLoadingEmbedded}
        isConnectingWhatsApp={isConnectingWhatsApp}
        metaBusinessId={metaBusinessId}
        wabaId={wabaId}
        phoneNumberId={phoneNumberId}
        displayPhone={displayPhone}
        accessToken={accessToken}
        onMetaBusinessIdChange={setMetaBusinessId}
        onWabaIdChange={setWabaId}
        onPhoneNumberIdChange={setPhoneNumberId}
        onDisplayPhoneChange={setDisplayPhone}
        onAccessTokenChange={setAccessToken}
        onSubmit={handleConnectWhatsApp}
      />
      <TestMessageSection
        selectedOrgId={selectedOrgId}
        testPhoneE164={testPhoneE164}
        isSendingTestMessage={isSendingTestMessage}
        onTestPhoneChange={setTestPhoneE164}
        onSubmit={handleSendTestMessage}
      />
      <OnboardingCompletionSection
        isCompleted={Boolean(onboardingStatus?.isCompleted)}
        onGoToInbox={() => {
          router.push("/dashboard");
        }}
      />

      {error ? (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}

      {info ? <p className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">{info}</p> : null}
    </section>
  );
}
