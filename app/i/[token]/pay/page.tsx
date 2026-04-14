import { notFound } from "next/navigation";

import { PublicInvoicePayWorkspace } from "@/components/invoices/PublicInvoicePayWorkspace";
import { getPublicInvoiceByToken } from "@/server/services/publicInvoiceService";

export default async function PublicInvoicePayPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const resolved = await params;
  const invoice = await getPublicInvoiceByToken(resolved.token);

  if (!invoice) {
    notFound();
  }

  return <PublicInvoicePayWorkspace token={resolved.token} />;
}
