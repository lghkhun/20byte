"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

function CopyCode({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <Button size="sm" variant="secondary" onClick={() => void handleCopy()}>
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-xl border border-border bg-muted/40 p-4 text-xs leading-6">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Endpoint({ method, path, description }: { method: string; path: string; description: string }) {
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-lg border border-border/70 p-3 text-sm">
      <span className="rounded bg-muted px-2 py-1 text-xs font-semibold">{method}</span>
      <code className="rounded bg-muted px-2 py-1 text-xs">{path}</code>
      <span className="text-muted-foreground">{description}</span>
    </div>
  );
}

export function DocsClient() {
  const baseUrl = "https://20byte.com/api/public/v1/whatsapp";

  const curlSend = useMemo(
    () => `curl -X POST '${baseUrl}/messages/send' \\
  -H 'Authorization: Bearer twapi_xxx_xxx' \\
  -H 'Content-Type: application/json' \\
  --data-raw '{\n    "to": "+628123456789",\n    "text": "Halo dari integrasi"\n  }'`,
    [baseUrl]
  );

  const payloadWebhook = `{
  "url": "https://platform-kamu.com/hooks/20byte",
  "enabled": true,
  "eventFilters": [
    "message.inbound",
    "message.outbound.status",
    "device.connection"
  ],
  "regenerateSecret": true
}`;

  const payloadSchedule = `{
  "to": "+628123456789",
  "text": "Follow up H+1",
  "dueAt": "2026-12-01T10:00:00.000Z"
}`;

  const responseFormat = `{
  "data": { ... },
  "meta": {}
}

{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Field to is required."
  }
}`;

  const webhookVerify = `import crypto from 'crypto';

function verify(signature, timestamp, rawBody, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(timestamp + '.' + rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}`;

  return (
    <main className="min-h-screen bg-background pt-28">
      <div className="mx-auto max-w-5xl space-y-8 px-6 pb-16">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">20byte Developer Docs</p>
          <h1 className="text-3xl font-semibold tracking-tight">WhatsApp Public API v1</h1>
          <p className="text-sm text-muted-foreground">
            Dokumentasi publik untuk integrasi pihak ketiga. Auth pakai <code>Bearer API Key</code> dari Settings → WhatsApp.
          </p>
        </header>

        <section className="rounded-2xl border border-border p-5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">Base URL:</p>
            <code className="rounded bg-muted px-2 py-1 text-xs">{baseUrl}</code>
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-border p-5">
          <h2 className="text-xl font-semibold">Endpoint Utama</h2>
          <Endpoint method="POST" path="/messages/send" description="Kirim text sync" />
          <Endpoint method="POST" path="/messages/send-media-url" description="Kirim media URL sync" />
          <Endpoint method="POST" path="/schedules" description="Buat schedule message" />
          <Endpoint method="GET" path="/messages/:messageId/status" description="Cek status message" />
          <Endpoint method="PUT" path="/webhook" description="Set/update webhook" />
          <Endpoint method="GET" path="/webhook" description="Get webhook config" />
        </section>

        <section className="space-y-4 rounded-2xl border border-border p-5">
          <h2 className="text-xl font-semibold">Contoh Request & Payload</h2>
          <CopyCode title="cURL - Kirim Pesan" code={curlSend} />
          <CopyCode title="Payload - Buat Schedule" code={payloadSchedule} />
          <CopyCode title="Payload - Set Webhook" code={payloadWebhook} />
        </section>

        <section className="space-y-4 rounded-2xl border border-border p-5">
          <h2 className="text-xl font-semibold">Format Response</h2>
          <CopyCode title="Success & Error" code={responseFormat} />
        </section>

        <section className="space-y-4 rounded-2xl border border-border p-5">
          <h2 className="text-xl font-semibold">Verifikasi Signature Webhook</h2>
          <CopyCode title="Node.js Verification" code={webhookVerify} />
        </section>

        <section className="space-y-2 rounded-2xl border border-border p-5 text-sm text-muted-foreground">
          <h2 className="text-xl font-semibold text-foreground">Dokumentasi Platform (Gratis/Open Source)</h2>
          <p>Rekomendasi: pakai <strong>Mintlify OSS</strong> atau <strong>Docusaurus</strong> untuk docs portal versi production.</p>
          <p>Link route internal ini tetap aktif sebagai public docs di <code>https://20byte.com/developers/whatsapp-api</code>.</p>
        </section>
      </div>
    </main>
  );
}
