import type { Metadata } from "next";

import { DocsClient } from "@/app/developers/whatsapp-api/DocsClient";

export const metadata: Metadata = {
  title: "20byte WhatsApp API",
  description: "Dokumentasi publik WhatsApp Public API v1 milik 20byte untuk integrasi platform eksternal."
};

export default function WhatsAppApiDocsPage() {
  return <DocsClient />;
}
