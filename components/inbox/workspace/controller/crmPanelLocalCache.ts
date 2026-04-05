"use client";

export type LocalLeadSettingsCacheValue = {
  leadStatus: string;
  businessCategory: string | null;
  crmStageId: string | null;
  notes: string | null;
};

export type LocalPipelineStageItem = {
  stageId: string;
  stageName: string;
  stageColor: string;
  position: number;
};

export type LocalPipelineStagesCacheValue = {
  pipelineId: string | null;
  stages: LocalPipelineStageItem[];
};

type StoredLeadSettingsCacheValue = {
  version: 1;
  orgId: string;
  customerId: string;
  leadStatus: string;
  businessCategory: string | null;
  crmStageId: string | null;
  notes: string | null;
  updatedAt: number;
  expiresAt: number;
};

type StoredPipelineStagesCacheValue = {
  version: 1;
  orgId: string;
  scope: string;
  pipelineId: string | null;
  stages: LocalPipelineStageItem[];
  updatedAt: number;
  expiresAt: number;
};

const LEAD_SETTINGS_PREFIX = "inbox:crm-panel:lead:v1:";
const PIPELINE_STAGES_PREFIX = "inbox:crm-panel:pipeline:v1:";
const CRM_PANEL_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function toFiniteNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function sanitizeNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function sanitizeLeadSettings(value: unknown): LocalLeadSettingsCacheValue | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<LocalLeadSettingsCacheValue>;
  if (typeof candidate.leadStatus !== "string" || !candidate.leadStatus.trim()) {
    return null;
  }

  return {
    leadStatus: candidate.leadStatus,
    businessCategory: sanitizeNullableString(candidate.businessCategory),
    crmStageId: sanitizeNullableString(candidate.crmStageId),
    notes: sanitizeNullableString(candidate.notes)
  };
}

function sanitizePipelineStages(value: unknown): LocalPipelineStageItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const candidate = item as Partial<LocalPipelineStageItem>;
      if (
        typeof candidate.stageId !== "string" ||
        typeof candidate.stageName !== "string" ||
        typeof candidate.stageColor !== "string"
      ) {
        return null;
      }

      return {
        stageId: candidate.stageId,
        stageName: candidate.stageName,
        stageColor: candidate.stageColor,
        position: toFiniteNumber(candidate.position) ?? 0
      } satisfies LocalPipelineStageItem;
    })
    .filter((item): item is LocalPipelineStageItem => Boolean(item))
    .sort((left, right) => left.position - right.position);
}

function removeStorageKey(storageKey: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // ignore localStorage errors
  }
}

function parseStoredLeadSettings(raw: string | null): StoredLeadSettingsCacheValue | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredLeadSettingsCacheValue>;
    if (
      parsed?.version !== 1 ||
      typeof parsed.orgId !== "string" ||
      typeof parsed.customerId !== "string" ||
      typeof parsed.leadStatus !== "string"
    ) {
      return null;
    }

    const expiresAt = toFiniteNumber(parsed.expiresAt) ?? 0;
    const updatedAt = toFiniteNumber(parsed.updatedAt) ?? Date.now();
    if (expiresAt <= Date.now()) {
      return null;
    }

    return {
      version: 1,
      orgId: parsed.orgId,
      customerId: parsed.customerId,
      leadStatus: parsed.leadStatus,
      businessCategory: sanitizeNullableString(parsed.businessCategory),
      crmStageId: sanitizeNullableString(parsed.crmStageId),
      notes: sanitizeNullableString(parsed.notes),
      updatedAt,
      expiresAt
    };
  } catch {
    return null;
  }
}

function parseStoredPipelineStages(raw: string | null): StoredPipelineStagesCacheValue | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredPipelineStagesCacheValue>;
    if (
      parsed?.version !== 1 ||
      typeof parsed.orgId !== "string" ||
      typeof parsed.scope !== "string"
    ) {
      return null;
    }

    const expiresAt = toFiniteNumber(parsed.expiresAt) ?? 0;
    const updatedAt = toFiniteNumber(parsed.updatedAt) ?? Date.now();
    if (expiresAt <= Date.now()) {
      return null;
    }

    return {
      version: 1,
      orgId: parsed.orgId,
      scope: parsed.scope,
      pipelineId: sanitizeNullableString(parsed.pipelineId),
      stages: sanitizePipelineStages(parsed.stages),
      updatedAt,
      expiresAt
    };
  } catch {
    return null;
  }
}

export function buildPipelineCacheScopeKey(pipelineId: string | null | undefined): string {
  const normalizedPipelineId = normalize(pipelineId);
  return normalizedPipelineId ? `pipeline:${normalizedPipelineId}` : "pipeline:open-default";
}

export function readLeadSettingsLocalCache(orgId: string, customerId: string): LocalLeadSettingsCacheValue | null {
  if (typeof window === "undefined") {
    return null;
  }

  const normalizedOrgId = normalize(orgId);
  const normalizedCustomerId = normalize(customerId);
  if (!normalizedOrgId || !normalizedCustomerId) {
    return null;
  }

  const storageKey = `${LEAD_SETTINGS_PREFIX}${normalizedOrgId}:${normalizedCustomerId}`;
  const parsed = parseStoredLeadSettings(window.localStorage.getItem(storageKey));
  if (!parsed) {
    removeStorageKey(storageKey);
    return null;
  }

  return {
    leadStatus: parsed.leadStatus,
    businessCategory: parsed.businessCategory,
    crmStageId: parsed.crmStageId,
    notes: parsed.notes
  };
}

export function writeLeadSettingsLocalCache(
  orgId: string,
  customerId: string,
  value: LocalLeadSettingsCacheValue
): LocalLeadSettingsCacheValue | null {
  if (typeof window === "undefined") {
    return null;
  }

  const normalizedOrgId = normalize(orgId);
  const normalizedCustomerId = normalize(customerId);
  if (!normalizedOrgId || !normalizedCustomerId) {
    return null;
  }

  const sanitized = sanitizeLeadSettings(value);
  if (!sanitized) {
    return null;
  }

  const now = Date.now();
  const payload: StoredLeadSettingsCacheValue = {
    version: 1,
    orgId: normalizedOrgId,
    customerId: normalizedCustomerId,
    leadStatus: sanitized.leadStatus,
    businessCategory: sanitized.businessCategory,
    crmStageId: sanitized.crmStageId,
    notes: sanitized.notes,
    updatedAt: now,
    expiresAt: now + CRM_PANEL_CACHE_TTL_MS
  };

  const storageKey = `${LEAD_SETTINGS_PREFIX}${normalizedOrgId}:${normalizedCustomerId}`;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // ignore localStorage quota/unavailable errors
  }

  return sanitized;
}

export function readPipelineStagesLocalCache(
  orgId: string,
  scope: string
): LocalPipelineStagesCacheValue | null {
  if (typeof window === "undefined") {
    return null;
  }

  const normalizedOrgId = normalize(orgId);
  const normalizedScope = normalize(scope);
  if (!normalizedOrgId || !normalizedScope) {
    return null;
  }

  const storageKey = `${PIPELINE_STAGES_PREFIX}${normalizedOrgId}:${normalizedScope}`;
  const parsed = parseStoredPipelineStages(window.localStorage.getItem(storageKey));
  if (!parsed) {
    removeStorageKey(storageKey);
    return null;
  }

  return {
    pipelineId: parsed.pipelineId,
    stages: parsed.stages
  };
}

export function writePipelineStagesLocalCache(
  orgId: string,
  scope: string,
  value: LocalPipelineStagesCacheValue
): LocalPipelineStagesCacheValue | null {
  if (typeof window === "undefined") {
    return null;
  }

  const normalizedOrgId = normalize(orgId);
  const normalizedScope = normalize(scope);
  if (!normalizedOrgId || !normalizedScope) {
    return null;
  }

  const sanitized: LocalPipelineStagesCacheValue = {
    pipelineId: sanitizeNullableString(value.pipelineId),
    stages: sanitizePipelineStages(value.stages)
  };

  const now = Date.now();
  const payload: StoredPipelineStagesCacheValue = {
    version: 1,
    orgId: normalizedOrgId,
    scope: normalizedScope,
    pipelineId: sanitized.pipelineId,
    stages: sanitized.stages,
    updatedAt: now,
    expiresAt: now + CRM_PANEL_CACHE_TTL_MS
  };

  const storageKey = `${PIPELINE_STAGES_PREFIX}${normalizedOrgId}:${normalizedScope}`;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // ignore localStorage quota/unavailable errors
  }

  return sanitized;
}

export function pruneCrmPanelLocalCache(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const expiredKeys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key) {
        continue;
      }

      if (key.startsWith(LEAD_SETTINGS_PREFIX)) {
        const parsed = parseStoredLeadSettings(window.localStorage.getItem(key));
        if (!parsed) {
          expiredKeys.push(key);
        }
        continue;
      }

      if (key.startsWith(PIPELINE_STAGES_PREFIX)) {
        const parsed = parseStoredPipelineStages(window.localStorage.getItem(key));
        if (!parsed) {
          expiredKeys.push(key);
        }
      }
    }

    expiredKeys.forEach((key) => {
      window.localStorage.removeItem(key);
    });
  } catch {
    // ignore localStorage failures
  }
}
