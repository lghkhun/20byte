import { Role } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { acquireIdempotencyLock } from "@/lib/redis/idempotency";
import { sendBaileysTextMessage } from "@/server/services/baileysService";
import { sendTransactionalEmail } from "@/server/services/emailService";

type BillingReminderInput = {
  orgId: string;
  shouldBroadcastWhatsapp: boolean;
  message: string;
};

function utcDayKey(now: Date): string {
  const year = now.getUTCFullYear();
  const month = `${now.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${now.getUTCDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
}

export async function triggerOrgBillingReminderBroadcast(input: BillingReminderInput): Promise<void> {
  if (!input.shouldBroadcastWhatsapp) {
    return;
  }

  const dayKey = utcDayKey(new Date());
  const lockKey = `billing:wa-reminder:${input.orgId}:${dayKey}`;
  const lockAcquired = await acquireIdempotencyLock(lockKey, 60 * 60 * 24);
  if (!lockAcquired) {
    return;
  }

  const members = await prisma.orgMember.findMany({
    where: { orgId: input.orgId },
    select: {
      role: true,
      user: {
        select: {
          phoneE164: true,
          email: true,
          name: true
        }
      }
    }
  });

  const uniquePhones = Array.from(
    new Set(members.map((member) => member.user.phoneE164).filter((value): value is string => Boolean(value)))
  );
  if (uniquePhones.length === 0) {
    return;
  }

  const text = `[Peringatan Tagihan 20byte]\n${input.message}`;
  await Promise.all(
    uniquePhones.map(async (phone) => {
      try {
        await sendBaileysTextMessage({
          orgId: input.orgId,
          toPhoneE164: phone,
          text
        });
      } catch {
        // no-op: reminder best effort
      }
    })
  );

  const ownerEmails = Array.from(
    new Set(
      members
        .filter((member) => member.role === Role.OWNER)
        .map((member) => member.user.email?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );
  if (ownerEmails.length === 0) {
    return;
  }

  const organization = await prisma.org.findUnique({
    where: {
      id: input.orgId
    },
    select: {
      name: true
    }
  });
  const orgName = organization?.name?.trim() || "Business Anda";
  const subject = `Reminder langganan 20byte untuk ${orgName}`;
  const html = `
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6">
      <p>Halo Owner,</p>
      <p>Berikut pengingat langganan untuk <strong>${orgName}</strong>:</p>
      <p>${input.message}</p>
      <p>Silakan buka halaman Billing untuk melanjutkan pembayaran.</p>
    </div>
  `.trim();
  const textEmail = [
    `Halo Owner,`,
    "",
    `Berikut pengingat langganan untuk ${orgName}:`,
    input.message,
    "",
    "Silakan buka halaman Billing untuk melanjutkan pembayaran."
  ].join("\n");

  try {
    await sendTransactionalEmail({
      to: ownerEmails,
      subject,
      text: textEmail,
      html
    });
  } catch {
    // no-op: reminder best effort
  }
}
