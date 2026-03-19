import { redirect } from "next/navigation";

export default function SettingsBusinessAliasPage() {
  redirect("/settings?tab=business");
}
