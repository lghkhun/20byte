import assert from "node:assert/strict";
import test from "node:test";

import { isSendEndpointPath } from "@/app/api/public/v1/whatsapp/routeGuards";
import {
  assertPublicApiKeyHashMatch,
  isPrivateOrLocalIp,
  parsePublicApiBearerToken,
  validatePublicMediaUrl
} from "@/server/services/whatsappPublicApiService";
import { ServiceError } from "@/server/services/serviceError";

function getServiceError(thunk: () => unknown): ServiceError {
  try {
    thunk();
    throw new Error("expected ServiceError");
  } catch (error) {
    assert.equal(error instanceof ServiceError, true);
    return error as ServiceError;
  }
}

test("parsePublicApiBearerToken rejects invalid API key format with INVALID_API_KEY", () => {
  const error = getServiceError(() => parsePublicApiBearerToken("Bearer wrongprefix_abc"));
  assert.equal(error.status, 401);
  assert.equal(error.code, "INVALID_API_KEY");
});

test("assertPublicApiKeyHashMatch treats missing/revoked lookup as INVALID_API_KEY", () => {
  const error = getServiceError(() => assertPublicApiKeyHashMatch(null, "abc"));
  assert.equal(error.status, 401);
  assert.equal(error.code, "INVALID_API_KEY");
});

test("isSendEndpointPath includes group send endpoints", () => {
  assert.equal(isSendEndpointPath("POST", "groups/messages/send"), true);
  assert.equal(isSendEndpointPath("POST", "groups/messages/send-media-url"), true);
  assert.equal(isSendEndpointPath("GET", "groups/messages/send"), false);
});

test("validatePublicMediaUrl rejects localhost/private targets", () => {
  const localhostError = getServiceError(() => validatePublicMediaUrl("http://localhost/file.jpg"));
  assert.equal(localhostError.code, "INVALID_MEDIA_URL");

  const privateIpError = getServiceError(() => validatePublicMediaUrl("http://127.0.0.1/file.jpg"));
  assert.equal(privateIpError.code, "INVALID_MEDIA_URL");

  const privateLanError = getServiceError(() => validatePublicMediaUrl("http://192.168.1.10/file.jpg"));
  assert.equal(privateLanError.code, "INVALID_MEDIA_URL");
});

test("isPrivateOrLocalIp flags blocked network ranges", () => {
  assert.equal(isPrivateOrLocalIp("127.0.0.1"), true);
  assert.equal(isPrivateOrLocalIp("10.1.2.3"), true);
  assert.equal(isPrivateOrLocalIp("172.20.10.5"), true);
  assert.equal(isPrivateOrLocalIp("192.168.1.100"), true);
  assert.equal(isPrivateOrLocalIp("8.8.8.8"), false);
});
