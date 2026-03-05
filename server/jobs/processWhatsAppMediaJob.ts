import { MessageType } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { decryptSensitiveToken } from "@/lib/security/tokenCipher";
import { transferWhatsAppMediaToR2 } from "@/server/services/whatsappMediaService";

type ProcessWhatsAppMediaJobPayload = {
  messageId: string;
};

function isMediaMessageType(type: MessageType): boolean {
  return (
    type === MessageType.IMAGE ||
    type === MessageType.VIDEO ||
    type === MessageType.AUDIO ||
    type === MessageType.DOCUMENT
  );
}

export async function processWhatsAppMediaJob(jobPayload: ProcessWhatsAppMediaJobPayload): Promise<void> {
  const messageId = jobPayload.messageId?.trim();
  if (!messageId) {
    return;
  }

  const message = await prisma.message.findUnique({
    where: {
      id: messageId
    },
    select: {
      id: true,
      orgId: true,
      conversationId: true,
      type: true,
      mediaId: true,
      mediaUrl: true,
      mimeType: true,
      fileName: true
    }
  });

  if (!message || !isMediaMessageType(message.type) || !message.mediaId || message.mediaUrl) {
    return;
  }

  const waAccount = await prisma.waAccount.findFirst({
    where: {
      orgId: message.orgId
    },
    orderBy: {
      connectedAt: "desc"
    },
    select: {
      accessTokenEnc: true
    }
  });

  if (!waAccount?.accessTokenEnc) {
    return;
  }

  const accessToken = decryptSensitiveToken(waAccount.accessTokenEnc);
  const transferResult = await transferWhatsAppMediaToR2({
    accessToken,
    orgId: message.orgId,
    conversationId: message.conversationId,
    messageId: message.id,
    mediaId: message.mediaId,
    mimeType: message.mimeType ?? undefined,
    fileName: message.fileName ?? undefined
  });

  await prisma.message.update({
    where: {
      id: message.id
    },
    data: {
      mediaUrl: transferResult.mediaUrl,
      mimeType: transferResult.mimeType ?? message.mimeType,
      fileSize: transferResult.fileSize ?? null
    }
  });
}

