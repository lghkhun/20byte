export const LEAD_STATUS_OPTIONS = [
  "NEW_LEAD",
  "PROSPECT",
  "ACTIVE_CLIENT",
  "UNQUALIFIED",
  "REMARKETING",
  "OLD_CLIENT",
  "OTHER",
  "PARTNERSHIP"
] as const;

export const FOLLOW_UP_OPTIONS = ["WAIT_RESPON", "CHAT", "CALL", "BLUEPRINT", "MEETING", "PENAWARAN", "DEALING"] as const;

export const BUSINESS_CATEGORY_OPTIONS = [
  "Retail & E-Commerce",
  "Automotive & Transportation",
  "Food & Beverage",
  "Healthcare & Wellness",
  "Education & Coaching",
  "Technology & SaaS",
  "Finance & Investment",
  "Real Estate & Property"
] as const;

export function formatLeadSettingLabel(value: string): string {
  if (value === "WAIT_RESPON") {
    return "Wait Response";
  }

  return value
    .split("_")
    .filter((part) => part.length > 0)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
