import { BankAccountManager } from "@/components/settings/BankAccountManager";
import { ShortlinkManager } from "@/components/settings/ShortlinkManager";

export default function ShortlinksSettingsPage() {
  return (
    <div className="space-y-6">
      <ShortlinkManager />
      <BankAccountManager />
    </div>
  );
}
