import { PlatformCouponDiscountType, PlatformCouponTarget, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { ServiceError } from "@/server/services/serviceError";

type CouponTarget = "BILLING" | "BUSINESS_PROVISIONING";

export type ResolvedCheckoutCoupon = {
  couponId: string;
  code: string;
  name: string;
  target: PlatformCouponTarget;
  discountType: PlatformCouponDiscountType;
  discountValue: number;
  maxDiscountCents: number | null;
  maxRedemptions: number | null;
  subtotalCents: number;
  discountCents: number;
  finalAmountCents: number;
};

function normalizeCouponCode(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toUpperCase() : "";
}

function normalizeOptionalText(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const value = raw.trim();
  return value ? value : null;
}

function normalizeOptionalDate(raw: unknown): Date | null {
  if (raw === null || raw === undefined || raw === "") {
    return null;
  }

  const date = raw instanceof Date ? raw : new Date(String(raw));
  if (Number.isNaN(date.getTime())) {
    throw new ServiceError(400, "INVALID_COUPON_DATE", "Tanggal kupon tidak valid.");
  }

  return date;
}

function normalizeInteger(raw: unknown, fieldName: string, { min = 0, max = Number.MAX_SAFE_INTEGER }: { min?: number; max?: number } = {}): number {
  const numeric = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(numeric) || !Number.isInteger(numeric) || numeric < min || numeric > max) {
    throw new ServiceError(400, "INVALID_COUPON_FIELD", `${fieldName} tidak valid.`);
  }
  return numeric;
}

export function parseOptionalBooleanField(raw: unknown, fieldName: string): boolean | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (typeof raw === "boolean") {
    return raw;
  }
  throw new ServiceError(400, "INVALID_COUPON_FIELD", `${fieldName} tidak valid.`);
}

function parseCouponTarget(raw: unknown): PlatformCouponTarget {
  const value = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (value === "BILLING" || value === "BUSINESS_PROVISIONING" || value === "ALL") {
    return value;
  }
  throw new ServiceError(400, "INVALID_COUPON_TARGET", "Target kupon tidak valid.");
}

function parseDiscountType(raw: unknown): PlatformCouponDiscountType {
  const value = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (value === "FIXED" || value === "PERCENT") {
    return value;
  }
  throw new ServiceError(400, "INVALID_COUPON_DISCOUNT_TYPE", "Jenis diskon kupon tidak valid.");
}

function calculateCouponDiscount(input: {
  subtotalCents: number;
  discountType: PlatformCouponDiscountType;
  discountValue: number;
  maxDiscountCents: number | null;
}): number {
  if (input.subtotalCents <= 0) {
    return 0;
  }

  if (input.discountType === "FIXED") {
    return Math.min(input.subtotalCents, Math.max(0, input.discountValue));
  }

  const percent = Math.max(0, Math.min(100, input.discountValue));
  let discount = Math.floor((input.subtotalCents * percent) / 100);
  if (input.maxDiscountCents !== null) {
    discount = Math.min(discount, Math.max(0, input.maxDiscountCents));
  }
  return Math.min(input.subtotalCents, discount);
}

export function normalizeCheckoutCouponCode(raw: unknown): string | null {
  const code = normalizeCouponCode(raw);
  return code ? code : null;
}

export async function resolveCouponForCheckout(input: {
  couponCode: string;
  target: CouponTarget;
  subtotalCents: number;
  now?: Date;
}): Promise<ResolvedCheckoutCoupon> {
  const code = normalizeCouponCode(input.couponCode);
  if (!code) {
    throw new ServiceError(400, "INVALID_COUPON_CODE", "Kode kupon wajib diisi.");
  }

  const now = input.now ?? new Date();
  const subtotalCents = Math.max(0, Math.round(input.subtotalCents));

  const coupon = await prisma.platformCoupon.findUnique({
    where: { code }
  });

  if (!coupon || !coupon.isActive) {
    throw new ServiceError(404, "COUPON_NOT_FOUND", "Kode kupon tidak ditemukan atau nonaktif.");
  }

  if (coupon.target !== "ALL" && coupon.target !== input.target) {
    throw new ServiceError(400, "COUPON_TARGET_MISMATCH", "Kupon tidak berlaku untuk transaksi ini.");
  }

  if (coupon.startsAt && coupon.startsAt.getTime() > now.getTime()) {
    throw new ServiceError(400, "COUPON_NOT_STARTED", "Kupon belum aktif.");
  }

  if (coupon.expiresAt && coupon.expiresAt.getTime() < now.getTime()) {
    throw new ServiceError(400, "COUPON_EXPIRED", "Kupon sudah kedaluwarsa.");
  }

  if (coupon.maxRedemptions !== null && coupon.redeemedCount >= coupon.maxRedemptions) {
    throw new ServiceError(400, "COUPON_USAGE_LIMIT_REACHED", "Kupon sudah mencapai batas penggunaan.");
  }

  if (coupon.minSubtotalCents !== null && subtotalCents < coupon.minSubtotalCents) {
    throw new ServiceError(
      400,
      "COUPON_MIN_SUBTOTAL_NOT_MET",
      `Kupon berlaku minimal transaksi Rp${new Intl.NumberFormat("id-ID").format(coupon.minSubtotalCents)}.`
    );
  }

  const discountCents = calculateCouponDiscount({
    subtotalCents,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    maxDiscountCents: coupon.maxDiscountCents
  });

  if (discountCents <= 0) {
    throw new ServiceError(400, "COUPON_NO_DISCOUNT", "Kupon tidak memberikan potongan untuk transaksi ini.");
  }

  return {
    couponId: coupon.id,
    code: coupon.code,
    name: coupon.name,
    target: coupon.target,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    maxDiscountCents: coupon.maxDiscountCents,
    maxRedemptions: coupon.maxRedemptions,
    subtotalCents,
    discountCents,
    finalAmountCents: Math.max(0, subtotalCents - discountCents)
  };
}

export async function listCouponsForSuperadmin(limit = 200) {
  const safeLimit = Math.max(1, Math.min(1000, Math.floor(limit)));
  return prisma.platformCoupon.findMany({
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    take: safeLimit
  });
}

export async function createCouponForSuperadmin(input: {
  actorUserId: string;
  code: unknown;
  name: unknown;
  description?: unknown;
  target?: unknown;
  discountType: unknown;
  discountValue: unknown;
  maxDiscountCents?: unknown;
  minSubtotalCents?: unknown;
  maxRedemptions?: unknown;
  startsAt?: unknown;
  expiresAt?: unknown;
  isActive?: unknown;
}) {
  const code = normalizeCouponCode(input.code);
  if (!code || code.length < 3 || code.length > 40 || !/^[A-Z0-9_-]+$/.test(code)) {
    throw new ServiceError(400, "INVALID_COUPON_CODE", "Kode kupon harus 3-40 karakter (A-Z, angka, _, -).");
  }

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 120) {
    throw new ServiceError(400, "INVALID_COUPON_NAME", "Nama kupon wajib diisi (maks 120 karakter).");
  }

  const target = input.target === undefined ? PlatformCouponTarget.ALL : parseCouponTarget(input.target);
  const discountType = parseDiscountType(input.discountType);
  const discountValue = normalizeInteger(input.discountValue, "discountValue", {
    min: 1,
    max: discountType === "PERCENT" ? 100 : 2_000_000_000
  });
  const maxDiscountCents = input.maxDiscountCents === undefined || input.maxDiscountCents === null || input.maxDiscountCents === ""
    ? null
    : normalizeInteger(input.maxDiscountCents, "maxDiscountCents", { min: 1 });
  const minSubtotalCents = input.minSubtotalCents === undefined || input.minSubtotalCents === null || input.minSubtotalCents === ""
    ? null
    : normalizeInteger(input.minSubtotalCents, "minSubtotalCents", { min: 0 });
  const maxRedemptions = input.maxRedemptions === undefined || input.maxRedemptions === null || input.maxRedemptions === ""
    ? null
    : normalizeInteger(input.maxRedemptions, "maxRedemptions", { min: 1 });
  const startsAt = normalizeOptionalDate(input.startsAt);
  const expiresAt = normalizeOptionalDate(input.expiresAt);
  const isActive = parseOptionalBooleanField(input.isActive, "isActive");
  if (startsAt && expiresAt && startsAt.getTime() > expiresAt.getTime()) {
    throw new ServiceError(400, "INVALID_COUPON_PERIOD", "Periode kupon tidak valid.");
  }

  if (discountType === "FIXED" && maxDiscountCents !== null) {
    throw new ServiceError(400, "INVALID_COUPON_MAX_DISCOUNT", "maxDiscountCents hanya untuk tipe PERCENT.");
  }

  const created = await prisma.platformCoupon.create({
    data: {
      code,
      name,
      description: normalizeOptionalText(input.description),
      target,
      discountType,
      discountValue,
      maxDiscountCents,
      minSubtotalCents,
      maxRedemptions,
      startsAt,
      expiresAt,
      isActive: isActive ?? true,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId
    }
  });

  await prisma.platformAuditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: "platform_coupon.create",
      targetType: "platform_coupon",
      targetId: created.id,
      metaJson: JSON.stringify({
        code: created.code,
        target: created.target,
        discountType: created.discountType,
        discountValue: created.discountValue
      })
    }
  }).catch(() => {
    // best effort
  });

  return created;
}

export async function updateCouponForSuperadmin(input: {
  actorUserId: string;
  couponId: string;
  name?: unknown;
  description?: unknown;
  target?: unknown;
  discountType?: unknown;
  discountValue?: unknown;
  maxDiscountCents?: unknown;
  minSubtotalCents?: unknown;
  maxRedemptions?: unknown;
  startsAt?: unknown;
  expiresAt?: unknown;
  isActive?: unknown;
}) {
  const couponId = String(input.couponId ?? "").trim();
  if (!couponId) {
    throw new ServiceError(400, "INVALID_COUPON_ID", "couponId wajib diisi.");
  }

  const existing = await prisma.platformCoupon.findUnique({
    where: { id: couponId }
  });

  if (!existing) {
    throw new ServiceError(404, "COUPON_NOT_FOUND", "Kupon tidak ditemukan.");
  }

  const nextDiscountType = input.discountType === undefined ? existing.discountType : parseDiscountType(input.discountType);

  const data: Prisma.PlatformCouponUpdateInput = {
    updatedByUserId: input.actorUserId
  };

  if (input.name !== undefined) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name || name.length > 120) {
      throw new ServiceError(400, "INVALID_COUPON_NAME", "Nama kupon wajib diisi (maks 120 karakter).");
    }
    data.name = name;
  }

  if (input.description !== undefined) {
    data.description = normalizeOptionalText(input.description);
  }

  if (input.target !== undefined) {
    data.target = parseCouponTarget(input.target);
  }

  if (input.discountType !== undefined) {
    data.discountType = nextDiscountType;
  }

  if (input.discountValue !== undefined) {
    data.discountValue = normalizeInteger(input.discountValue, "discountValue", {
      min: 1,
      max: nextDiscountType === "PERCENT" ? 100 : 2_000_000_000
    });
  }

  if (input.maxDiscountCents !== undefined) {
    data.maxDiscountCents = input.maxDiscountCents === null || input.maxDiscountCents === ""
      ? null
      : normalizeInteger(input.maxDiscountCents, "maxDiscountCents", { min: 1 });
  }

  if (input.minSubtotalCents !== undefined) {
    data.minSubtotalCents = input.minSubtotalCents === null || input.minSubtotalCents === ""
      ? null
      : normalizeInteger(input.minSubtotalCents, "minSubtotalCents", { min: 0 });
  }

  if (input.maxRedemptions !== undefined) {
    const maxRedemptions = input.maxRedemptions === null || input.maxRedemptions === ""
      ? null
      : normalizeInteger(input.maxRedemptions, "maxRedemptions", { min: 1 });

    if (maxRedemptions !== null && maxRedemptions < existing.redeemedCount) {
      throw new ServiceError(400, "INVALID_COUPON_MAX_REDEMPTIONS", "maxRedemptions tidak boleh kurang dari redeemedCount saat ini.");
    }

    data.maxRedemptions = maxRedemptions;
  }

  if (input.startsAt !== undefined) {
    data.startsAt = normalizeOptionalDate(input.startsAt);
  }

  if (input.expiresAt !== undefined) {
    data.expiresAt = normalizeOptionalDate(input.expiresAt);
  }

  if (input.isActive !== undefined) {
    data.isActive = parseOptionalBooleanField(input.isActive, "isActive");
  }

  const previewStartsAt = data.startsAt !== undefined ? (data.startsAt as Date | null) : existing.startsAt;
  const previewExpiresAt = data.expiresAt !== undefined ? (data.expiresAt as Date | null) : existing.expiresAt;
  if (previewStartsAt && previewExpiresAt && previewStartsAt.getTime() > previewExpiresAt.getTime()) {
    throw new ServiceError(400, "INVALID_COUPON_PERIOD", "Periode kupon tidak valid.");
  }

  const previewType = (data.discountType as PlatformCouponDiscountType | undefined) ?? existing.discountType;
  const previewMaxDiscount = data.maxDiscountCents !== undefined ? (data.maxDiscountCents as number | null) : existing.maxDiscountCents;
  if (previewType === "FIXED" && previewMaxDiscount !== null) {
    throw new ServiceError(400, "INVALID_COUPON_MAX_DISCOUNT", "maxDiscountCents hanya untuk tipe PERCENT.");
  }

  const updated = await prisma.platformCoupon.update({
    where: { id: couponId },
    data
  });

  await prisma.platformAuditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: "platform_coupon.update",
      targetType: "platform_coupon",
      targetId: updated.id,
      metaJson: JSON.stringify({
        code: updated.code,
        isActive: updated.isActive,
        maxRedemptions: updated.maxRedemptions,
        redeemedCount: updated.redeemedCount
      })
    }
  }).catch(() => {
    // best effort
  });

  return updated;
}
