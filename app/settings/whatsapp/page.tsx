import { redirect } from "next/navigation";

export default function SettingsWhatsAppAliasPage() {
  redirect("/settings?tab=whatsapp");
}
