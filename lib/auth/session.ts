import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest, NextResponse } from "next/server";

import { getAuthSecret } from "@/lib/env";

export const SESSION_COOKIE_NAME = "session_token";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 3;

export type SessionPayload = {
  userId: string;
  email: string;
  name: string | null;
  iat: number;
  exp: number;
};

type SessionTokenInput = {
  userId: string;
  email: string;
  name: string | null;
};

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signValue(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function hasValidSignature(unsignedToken: string, providedSignature: string, secret: string): boolean {
  const expectedSignature = signValue(unsignedToken, secret);
  const expectedBytes = Buffer.from(expectedSignature, "utf8");
  const providedBytes = Buffer.from(providedSignature, "utf8");

  if (expectedBytes.length !== providedBytes.length) {
    return false;
  }

  return timingSafeEqual(expectedBytes, providedBytes);
}

export function createSessionToken(input: SessionTokenInput): string {
  const authSecret = getAuthSecret();
  const iat = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    userId: input.userId,
    email: input.email,
    name: input.name,
    iat,
    exp: iat + SESSION_TTL_SECONDS
  };

  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = encodeBase64Url(JSON.stringify(header));
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signature = signValue(unsignedToken, authSecret);

  return `${unsignedToken}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  let authSecret: string;
  try {
    authSecret = getAuthSecret();
  } catch {
    return null;
  }
  const tokenParts = token.split(".");
  if (tokenParts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, providedSignature] = tokenParts;
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  if (!hasValidSignature(unsignedToken, providedSignature, authSecret)) {
    return null;
  }

  try {
    const decodedHeader = JSON.parse(decodeBase64Url(encodedHeader)) as { alg?: string; typ?: string };
    if (decodedHeader.alg !== "HS256" || decodedHeader.typ !== "JWT") {
      return null;
    }

    const decodedPayload = JSON.parse(decodeBase64Url(encodedPayload)) as Partial<SessionPayload>;
    if (
      typeof decodedPayload.userId !== "string" ||
      typeof decodedPayload.email !== "string" ||
      (decodedPayload.name !== null && typeof decodedPayload.name !== "string") ||
      typeof decodedPayload.iat !== "number" ||
      typeof decodedPayload.exp !== "number"
    ) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (decodedPayload.exp <= now) {
      return null;
    }

    return {
      userId: decodedPayload.userId,
      email: decodedPayload.email,
      name: decodedPayload.name,
      iat: decodedPayload.iat,
      exp: decodedPayload.exp
    };
  } catch {
    return null;
  }
}

export function getSessionFromRequest(request: NextRequest): SessionPayload | null {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}
