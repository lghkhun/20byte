import { InvoiceKind, PaymentMilestoneType, Role } from "@prisma/client";

import { ServiceError } from "@/server/services/serviceError";

export function assertMarkPaidProofRule(actorRole: Role, hasProof: boolean): void {
  if (actorRole !== Role.OWNER && !hasProof) {
    throw new ServiceError(
      403,
      "PROOF_REQUIRED_FOR_MARK_PAID",
      "Admin/CS must attach payment proof before marking invoice paid."
    );
  }
}

export function resolveTargetMilestoneTypes(
  invoiceKind: InvoiceKind,
  requestedMilestoneType?: PaymentMilestoneType
): PaymentMilestoneType[] {
  if (invoiceKind === InvoiceKind.FULL) {
    return [PaymentMilestoneType.FULL];
  }

  if (requestedMilestoneType) {
    if (requestedMilestoneType !== PaymentMilestoneType.DP && requestedMilestoneType !== PaymentMilestoneType.FINAL) {
      throw new ServiceError(400, "INVALID_MILESTONE_TYPE", "DP_AND_FINAL invoice accepts DP or FINAL milestone type.");
    }

    return [requestedMilestoneType];
  }

  return [PaymentMilestoneType.DP, PaymentMilestoneType.FINAL];
}

export function assertMilestoneTypesExist(
  validMilestoneTypes: Iterable<PaymentMilestoneType>,
  targetMilestoneTypes: PaymentMilestoneType[]
): void {
  const validSet = new Set(validMilestoneTypes);
  for (const type of targetMilestoneTypes) {
    if (!validSet.has(type)) {
      throw new ServiceError(400, "MILESTONE_NOT_FOUND", "Milestone type does not exist for this invoice.");
    }
  }
}
