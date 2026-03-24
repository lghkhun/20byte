import { prisma } from "@/lib/db/prisma";
import { acquireIdempotencyLock } from "@/lib/redis/idempotency";
import { sendBaileysTextMessage } from "@/server/services/baileysService";

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
      user: {
        select: {
          phoneE164: true
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
}
