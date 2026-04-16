import type { NextRequest, NextResponse } from "next/server";

export const ACTIVE_ORG_COOKIE_NAME = "active_org_id";

export function getActiveOrgIdFromRequest(request: NextRequest): string {
  return request.cookies.get(ACTIVE_ORG_COOKIE_NAME)?.value?.trim() ?? "";
}

export function setActiveOrgCookie(response: NextResponse, orgId: string): void {
  response.cookies.set({
    name: ACTIVE_ORG_COOKIE_NAME,
    value: orgId,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180
  });
}

export function clearActiveOrgCookie(response: NextResponse): void {
  response.cookies.set({
    name: ACTIVE_ORG_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}
