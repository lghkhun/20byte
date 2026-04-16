type OrgSummary = {
  id: string;
  name: string;
  role: string;
  createdAt: string;
};

type OrgsResponse = {
  data?: {
    organizations?: OrgSummary[];
    activeOrgId?: string | null;
  };
  error?: {
    message?: string;
  };
};

const ORG_CACHE_TTL_MS = 60_000;

let orgCache: {
  expiresAt: number;
  value: OrgSummary[];
  activeOrgId: string | null;
} | null = null;

let inflightOrgsPromise: Promise<OrgSummary[]> | null = null;

function parseOrganizations(payload: OrgsResponse | null): OrgSummary[] {
  if (!payload?.data?.organizations || !Array.isArray(payload.data.organizations)) {
    return [];
  }

  return payload.data.organizations;
}

export async function fetchOrganizationsCached(options?: { force?: boolean }): Promise<OrgSummary[]> {
  const force = Boolean(options?.force);
  const now = Date.now();

  const hasUsableCache = Boolean(orgCache && orgCache.expiresAt > now && orgCache.value.length > 0);
  if (!force && hasUsableCache && orgCache) {
    return orgCache.value;
  }

  if (!force && inflightOrgsPromise) {
    return inflightOrgsPromise;
  }

  inflightOrgsPromise = (async () => {
    const response = await fetch("/api/orgs", { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as OrgsResponse | null;
    if (!response.ok) {
      throw new Error(payload?.error?.message ?? "Failed to load organizations.");
    }

    const organizations = parseOrganizations(payload);
    orgCache = {
      value: organizations,
      activeOrgId: payload?.data?.activeOrgId ?? organizations[0]?.id ?? null,
      expiresAt: Date.now() + ORG_CACHE_TTL_MS
    };
    return organizations;
  })();

  try {
    return await inflightOrgsPromise;
  } finally {
    inflightOrgsPromise = null;
  }
}

export function invalidateOrganizationsCache(): void {
  orgCache = null;
  inflightOrgsPromise = null;
}

export function getCachedActiveOrgId(): string | null {
  return orgCache?.activeOrgId ?? null;
}
