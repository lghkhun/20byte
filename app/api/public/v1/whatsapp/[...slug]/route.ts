import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/http";
import { sendRedisCommand } from "@/lib/redis/redisResp";
import {
  authenticatePublicWhatsAppApiKey,
  cancelPublicSchedule,
  coercePublicScheduleDueAt,
  createPublicSendSchedule,
  getPublicSchedule,
  parsePublicSendPayload,
  publicCheckNumber,
  publicDeleteWebhook,
  publicGenerateQr,
  publicGenerateQrLink,
  publicGetDeviceInfo,
  publicGetQrStatus,
  publicGetMessageStatus,
  publicGetWebhook,
  publicListGroupMembers,
  publicListGroups,
  publicLogoutDevice,
  publicPutWebhook,
  publicSendMediaByUrl,
  publicSendTextMessage
} from "@/server/services/whatsappPublicApiService";
import { ServiceError } from "@/server/services/serviceError";

type JsonBody = Record<string, unknown>;

function normalize(value: string | undefined): string {
  return (value ?? "").trim();
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

async function parseJsonBody(request: NextRequest): Promise<JsonBody> {
  try {
    const parsed = (await request.json()) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as JsonBody) : {};
  } catch {
    return {};
  }
}

function formatPath(request: NextRequest): string {
  return request.nextUrl.pathname.replace(/\/+$/, "");
}

function getRedisUrl(): string | null {
  const value = process.env.REDIS_URL?.trim() ?? "";
  return value || null;
}

async function enforceRateLimit(input: {
  apiKeyId: string;
  bucket: string;
  limit: number;
  windowSec: number;
}): Promise<void> {
  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    return;
  }

  const key = `20byte:ratelimit:${input.bucket}:${input.apiKeyId}`;
  const incremented = await sendRedisCommand(redisUrl, ["INCR", key]);
  const current = typeof incremented === "number" ? incremented : Number(incremented);
  if (current === 1) {
    await sendRedisCommand(redisUrl, ["EXPIRE", key, String(input.windowSec)]);
  }

  if (!Number.isFinite(current) || current > input.limit) {
    throw new ServiceError(429, "RATE_LIMITED", "Rate limit exceeded. Please retry later.");
  }
}

async function handleRequest(method: string, request: NextRequest, slug: string[]): Promise<Response> {
  const auth = await authenticatePublicWhatsAppApiKey(request.headers.get("authorization"));
  const orgId = auth.orgId;

  const path = slug.join("/");
  const body = ["POST", "PUT", "PATCH", "DELETE"].includes(method) ? await parseJsonBody(request) : {};

  await enforceRateLimit({
    apiKeyId: auth.apiKeyId,
    bucket: "global",
    limit: 240,
    windowSec: 60
  });

  if (method === "POST" && path === "messages/send") {
    await enforceRateLimit({ apiKeyId: auth.apiKeyId, bucket: "send", limit: 90, windowSec: 60 });
    const payload = parsePublicSendPayload(body);
    const result = await publicSendTextMessage({
      orgId,
      to: payload.to,
      text: payload.text ?? ""
    });
    return successResponse(result, 200);
  }

  if (method === "POST" && path === "messages/send-async") {
    await enforceRateLimit({ apiKeyId: auth.apiKeyId, bucket: "send", limit: 90, windowSec: 60 });
    const payload = parsePublicSendPayload(body);
    const isGroup = payload.to.includes("@g.us");
    const schedule = await createPublicSendSchedule({
      orgId,
      targetType: isGroup ? "group" : "contact",
      to: payload.to,
      messageType: "text",
      text: payload.text ?? "",
      dueAt: new Date().toISOString()
    });
    return successResponse(
      {
        accepted: true,
        scheduleId: schedule.scheduleId,
        status: schedule.status
      },
      202
    );
  }

  if (method === "POST" && path === "messages/send-media-url") {
    await enforceRateLimit({ apiKeyId: auth.apiKeyId, bucket: "send", limit: 60, windowSec: 60 });
    const payload = parsePublicSendPayload(body);
    const result = await publicSendMediaByUrl({
      orgId,
      to: payload.to,
      mediaUrl: payload.mediaUrl ?? "",
      caption: payload.caption,
      fileName: payload.fileName,
      mimeType: payload.mimeType
    });
    return successResponse(result, 200);
  }

  if (method === "POST" && path === "messages/send-media-url-async") {
    await enforceRateLimit({ apiKeyId: auth.apiKeyId, bucket: "send", limit: 60, windowSec: 60 });
    const payload = parsePublicSendPayload(body);
    const isGroup = payload.to.includes("@g.us");
    const schedule = await createPublicSendSchedule({
      orgId,
      targetType: isGroup ? "group" : "contact",
      to: payload.to,
      messageType: "media_url",
      mediaUrl: payload.mediaUrl ?? "",
      caption: payload.caption,
      fileName: payload.fileName,
      mimeType: payload.mimeType,
      dueAt: new Date().toISOString()
    });
    return successResponse(
      {
        accepted: true,
        scheduleId: schedule.scheduleId,
        status: schedule.status
      },
      202
    );
  }

  if (method === "POST" && path === "groups/messages/send") {
    const payload = parsePublicSendPayload(body);
    const result = await publicSendTextMessage({
      orgId,
      to: payload.to,
      text: payload.text ?? ""
    });
    return successResponse(result, 200);
  }

  if (method === "POST" && path === "groups/messages/send-media-url") {
    const payload = parsePublicSendPayload(body);
    const result = await publicSendMediaByUrl({
      orgId,
      to: payload.to,
      mediaUrl: payload.mediaUrl ?? "",
      caption: payload.caption,
      fileName: payload.fileName,
      mimeType: payload.mimeType
    });
    return successResponse(result, 200);
  }

  if (method === "POST" && path === "contacts/check-number") {
    const to = normalize(typeof body.phone === "string" ? body.phone : typeof body.to === "string" ? body.to : "");
    const result = await publicCheckNumber(orgId, to);
    return successResponse(result, 200);
  }

  if (method === "GET" && path === "groups") {
    const result = await publicListGroups(orgId);
    return successResponse(result, 200);
  }

  if (method === "GET" && /^groups\/[^/]+\/members$/.test(path)) {
    const groupId = decodeURIComponent(path.split("/")[1] ?? "");
    const result = await publicListGroupMembers(orgId, groupId);
    return successResponse(result, 200);
  }

  if (method === "GET" && path === "device/info") {
    const result = await publicGetDeviceInfo(orgId);
    return successResponse(result, 200);
  }

  if (method === "GET" && path === "device/qr-status") {
    const result = await publicGetQrStatus(orgId);
    return successResponse(result, 200);
  }

  if (method === "POST" && path === "device/generate-qr") {
    const result = await publicGenerateQr(orgId);
    return successResponse(result, 200);
  }

  if (method === "POST" && path === "device/generate-qr-link") {
    const result = await publicGenerateQrLink(orgId);
    return successResponse(result, 200);
  }

  if (method === "POST" && path === "device/logout") {
    const result = await publicLogoutDevice(orgId);
    return successResponse(result, 200);
  }

  if (method === "GET" && /^messages\/[^/]+\/status$/.test(path)) {
    const messageId = decodeURIComponent(path.split("/")[1] ?? "");
    const result = await publicGetMessageStatus({
      orgId,
      messageId
    });
    return successResponse(result, 200);
  }

  if (method === "POST" && path === "schedules") {
    const payload = parsePublicSendPayload(body);
    const dueAt = coercePublicScheduleDueAt(body.dueAt);
    const isGroup = payload.to.includes("@g.us");
    const messageType = payload.mediaUrl ? "media_url" : "text";
    const schedule = await createPublicSendSchedule({
      orgId,
      targetType: isGroup ? "group" : "contact",
      to: payload.to,
      messageType,
      text: payload.text,
      mediaUrl: payload.mediaUrl,
      caption: payload.caption,
      fileName: payload.fileName,
      mimeType: payload.mimeType,
      dueAt
    });
    return successResponse(schedule, 201);
  }

  if (method === "GET" && /^schedules\/[^/]+$/.test(path)) {
    const scheduleId = decodeURIComponent(path.split("/")[1] ?? "");
    const result = await getPublicSchedule({ orgId, scheduleId });
    return successResponse(result, 200);
  }

  if (method === "DELETE" && /^schedules\/[^/]+$/.test(path)) {
    const scheduleId = decodeURIComponent(path.split("/")[1] ?? "");
    const result = await cancelPublicSchedule({ orgId, scheduleId });
    return successResponse(result, 200);
  }

  if (method === "PUT" && path === "webhook") {
    const result = await publicPutWebhook({
      orgId,
      url: body.url,
      enabled: body.enabled,
      eventFilters: body.eventFilters,
      regenerateSecret: body.regenerateSecret
    });
    return successResponse(result, 200);
  }

  if (method === "GET" && path === "webhook") {
    const result = await publicGetWebhook(orgId);
    return successResponse(result, 200);
  }

  if (method === "DELETE" && path === "webhook") {
    const result = await publicDeleteWebhook(orgId);
    return successResponse(result, 200);
  }

  return errorResponse(404, "PUBLIC_WHATSAPP_API_NOT_FOUND", `Endpoint not found: ${method} ${formatPath(request)}`);
}

async function run(method: string, request: NextRequest, slug: string[]): Promise<Response> {
  try {
    return await handleRequest(method, request, slug);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "PUBLIC_WHATSAPP_API_FAILED", stringifyError(error));
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ slug?: string[] }> }) {
  const params = await context.params;
  return run("GET", request, params.slug ?? []);
}

export async function POST(request: NextRequest, context: { params: Promise<{ slug?: string[] }> }) {
  const params = await context.params;
  return run("POST", request, params.slug ?? []);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ slug?: string[] }> }) {
  const params = await context.params;
  return run("PUT", request, params.slug ?? []);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ slug?: string[] }> }) {
  const params = await context.params;
  return run("DELETE", request, params.slug ?? []);
}
