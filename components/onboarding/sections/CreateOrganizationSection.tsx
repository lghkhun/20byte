import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CreateOrganizationSectionProps = {
  orgName: string;
  isCreatingOrg: boolean;
  onOrgNameChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function CreateOrganizationSection({
  orgName,
  isCreatingOrg,
  onOrgNameChange,
  onSubmit
}: CreateOrganizationSectionProps) {
  return (
    <div className="rounded-xl border border-border bg-surface/70 p-4">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <label htmlFor="org-name" className="text-sm font-medium">
            Organization name
          </label>
          <Input
            id="org-name"
            name="org-name"
            value={orgName}
            onChange={(event) => onOrgNameChange(event.target.value)}
            placeholder="20byte Studio"
            required
          />
        </div>
        <Button type="submit" disabled={isCreatingOrg}>
          {isCreatingOrg ? "Creating..." : "Create organization"}
        </Button>
      </form>
    </div>
  );
}
