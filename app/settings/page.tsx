import { SettingsWorkspace } from "@/components/settings/SettingsWorkspace";

export default function SettingsPage({
  searchParams
}: {
  searchParams?: {
    tab?: string;
  };
}) {
  return <SettingsWorkspace initialTab={searchParams?.tab ?? "business"} />;
}
