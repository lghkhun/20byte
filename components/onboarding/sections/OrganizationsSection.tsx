import { Button } from "@/components/ui/button";

import type { OrganizationSummary } from "@/components/onboarding/types";

type OrganizationsSectionProps = {
  organizations: OrganizationSummary[];
  selectedOrgId: string;
  selectedOrganization: OrganizationSummary | null;
  isLoadingOrgs: boolean;
  onRefresh: () => void;
  onSelectOrg: (orgId: string) => void;
};

export function OrganizationsSection({
  organizations,
  selectedOrgId,
  selectedOrganization,
  isLoadingOrgs,
  onRefresh,
  onSelectOrg
}: OrganizationsSectionProps) {
  return (
    <div className="rounded-xl border border-border bg-surface/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Your Organizations</h2>
        <Button variant="secondary" size="sm" type="button" onClick={onRefresh} disabled={isLoadingOrgs}>
          {isLoadingOrgs ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {organizations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No organizations yet. Create one to start onboarding.</p>
      ) : (
        <div className="space-y-3">
          <select
            className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm"
            value={selectedOrgId}
            onChange={(event) => onSelectOrg(event.target.value)}
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
  );
}
