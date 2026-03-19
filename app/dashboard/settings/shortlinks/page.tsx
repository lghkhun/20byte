import { redirect } from "next/navigation";

export default function ShortlinksSettingsPage() {
  redirect("/settings?tab=shortlinks");
}
