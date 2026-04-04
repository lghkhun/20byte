import { MessageType } from "@prisma/client";

export function isRetryableOutboundType(type: MessageType): boolean {
  return (
    type === MessageType.TEXT ||
    type === MessageType.TEMPLATE ||
    type === MessageType.IMAGE ||
    type === MessageType.VIDEO ||
    type === MessageType.AUDIO ||
    type === MessageType.DOCUMENT
  );
}
