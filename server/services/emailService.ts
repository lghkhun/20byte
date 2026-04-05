import { getResendConfig } from "@/lib/env";
import { ServiceError } from "@/server/services/serviceError";

type SendTransactionalEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string | null;
};

type ResendEmailResponse = {
  id?: string;
  message?: string;
  error?: string;
};

function toRecipientList(value: string | string[]): string[] {
  return (Array.isArray(value) ? value : [value])
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseResendError(payload: ResendEmailResponse | null, status: number): string {
  const message = payload?.message?.trim() || payload?.error?.trim();
  if (message) {
    return message;
  }

  return `Resend request failed with status ${status}.`;
}

export function isTransactionalEmailEnabled(): boolean {
  return getResendConfig().enabled;
}

export async function sendTransactionalEmail(input: SendTransactionalEmailInput): Promise<{ messageId: string | null }> {
  const config = getResendConfig();
  if (!config.enabled) {
    throw new ServiceError(
      503,
      "EMAIL_PROVIDER_NOT_CONFIGURED",
      "Email provider belum dikonfigurasi. Isi RESEND_API_KEY dan RESEND_FROM_EMAIL di .env."
    );
  }

  const recipients = toRecipientList(input.to);
  if (recipients.length === 0) {
    throw new ServiceError(400, "EMAIL_RECIPIENT_REQUIRED", "Recipient email is required.");
  }

  const subject = input.subject.trim();
  if (!subject) {
    throw new ServiceError(400, "EMAIL_SUBJECT_REQUIRED", "Email subject is required.");
  }

  const html = input.html.trim();
  if (!html) {
    throw new ServiceError(400, "EMAIL_HTML_REQUIRED", "Email body is required.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: config.fromEmail,
      to: recipients,
      subject,
      html,
      text: input.text?.trim() || undefined,
      reply_to: input.replyTo?.trim() || config.replyToEmail || undefined
    })
  });

  const payload = (await response.json().catch(() => null)) as ResendEmailResponse | null;
  if (!response.ok) {
    throw new ServiceError(502, "EMAIL_SEND_FAILED", parseResendError(payload, response.status));
  }

  return {
    messageId: payload?.id ?? null
  };
}
