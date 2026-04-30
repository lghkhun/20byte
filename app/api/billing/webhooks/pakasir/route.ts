import type { NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/http";

export async function POST(request: NextRequest) {
  void request;
  return errorResponse(410, "WEBHOOK_DEPRECATED", "Pakasir webhook is deprecated. Use /api/billing/webhooks/louvin.");
}
