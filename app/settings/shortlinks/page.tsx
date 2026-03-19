import { redirect } from "next/navigation";

export default function SettingsShortlinksAliasPage() {
  redirect("/settings?tab=shortlinks");
}
