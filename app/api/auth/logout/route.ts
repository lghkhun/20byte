import { NextResponse } from "next/server";

import { clearActiveOrgCookie } from "@/lib/auth/activeOrg";
import { clearSessionCookie } from "@/lib/auth/session";

export async function POST() {
  const response = NextResponse.json({
    data: { ok: true },
    meta: {}
  });
  clearSessionCookie(response);
  clearActiveOrgCookie(response);
  return response;
}
