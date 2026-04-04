export type DeliveryStatus = "SENT" | "DELIVERED" | "READ" | null;

export function deliveryRank(status: DeliveryStatus | undefined): number {
  if (status === "READ") return 3;
  if (status === "DELIVERED") return 2;
  if (status === "SENT") return 1;
  return 0;
}

export function resolveNextDeliveryState(input: {
  currentStatus: DeliveryStatus;
  currentDeliveredAt: Date | null;
  currentReadAt: Date | null;
  incomingStatus: "SENT" | "DELIVERED" | "READ";
  at: Date;
}): {
  shouldPersist: boolean;
  deliveryStatus: DeliveryStatus;
  deliveredAt: Date | null;
  readAt: Date | null;
} {
  const incomingRank = deliveryRank(input.incomingStatus);
  const currentRank = deliveryRank(input.currentStatus);

  let deliveryStatus = input.currentStatus;
  let deliveredAt = input.currentDeliveredAt;
  let readAt = input.currentReadAt;

  if (incomingRank > currentRank) {
    deliveryStatus = input.incomingStatus;
  }

  if (input.incomingStatus === "DELIVERED" && !deliveredAt) {
    deliveredAt = input.at;
  }

  if (input.incomingStatus === "READ") {
    if (!deliveredAt) {
      deliveredAt = input.at;
    }
    if (!readAt) {
      readAt = input.at;
    }
  }

  const shouldPersist =
    deliveryStatus !== input.currentStatus ||
    deliveredAt?.getTime() !== input.currentDeliveredAt?.getTime() ||
    readAt?.getTime() !== input.currentReadAt?.getTime();

  return {
    shouldPersist,
    deliveryStatus,
    deliveredAt,
    readAt
  };
}
