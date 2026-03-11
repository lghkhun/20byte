import test from "node:test";
import assert from "node:assert/strict";

import {
  assertAllowedInboundFileSize,
  assertAllowedInboundMimeType,
  IMAGE_AND_DOCUMENT_SIZE_LIMIT_BYTES,
  VIDEO_SIZE_LIMIT_BYTES,
  isAllowedInboundMimeType,
  maxAllowedSizeByMimeType,
  normalizeMimeType
} from "@/server/services/storage/mediaPolicy";
import { ServiceError } from "@/server/services/serviceError";

test("media policy allows only explicit MIME whitelist", () => {
  assert.equal(isAllowedInboundMimeType("image/jpeg"), true);
  assert.equal(isAllowedInboundMimeType("video/mp4"), true);
  assert.equal(isAllowedInboundMimeType("audio/ogg"), true);
  assert.equal(isAllowedInboundMimeType("application/pdf"), true);

  assert.equal(isAllowedInboundMimeType("image/gif"), false);
  assert.equal(isAllowedInboundMimeType("audio/wav"), false);
  assert.equal(isAllowedInboundMimeType("application/zip"), false);
});

test("assertAllowedInboundMimeType throws ServiceError for unsupported types", () => {
  assert.throws(
    () => assertAllowedInboundMimeType("image/gif"),
    (error: unknown) => error instanceof ServiceError && error.code === "UNSUPPORTED_MEDIA_TYPE"
  );
});

test("media policy applies 50MB only for video and 10MB for others", () => {
  assert.equal(maxAllowedSizeByMimeType("video/mp4"), VIDEO_SIZE_LIMIT_BYTES);
  assert.equal(maxAllowedSizeByMimeType("video/3gpp"), VIDEO_SIZE_LIMIT_BYTES);
  assert.equal(maxAllowedSizeByMimeType("image/jpeg"), IMAGE_AND_DOCUMENT_SIZE_LIMIT_BYTES);
  assert.equal(maxAllowedSizeByMimeType("application/pdf"), IMAGE_AND_DOCUMENT_SIZE_LIMIT_BYTES);
});

test("assertAllowedInboundFileSize enforces size limit", () => {
  assert.doesNotThrow(() => assertAllowedInboundFileSize("image/jpeg", IMAGE_AND_DOCUMENT_SIZE_LIMIT_BYTES));
  assert.doesNotThrow(() => assertAllowedInboundFileSize("video/mp4", VIDEO_SIZE_LIMIT_BYTES));

  assert.throws(
    () => assertAllowedInboundFileSize("image/jpeg", IMAGE_AND_DOCUMENT_SIZE_LIMIT_BYTES + 1),
    (error: unknown) => error instanceof ServiceError && error.code === "MEDIA_FILE_TOO_LARGE"
  );

  assert.throws(
    () => assertAllowedInboundFileSize("video/mp4", VIDEO_SIZE_LIMIT_BYTES + 1),
    (error: unknown) => error instanceof ServiceError && error.code === "MEDIA_FILE_TOO_LARGE"
  );
});

test("normalizeMimeType trims and lowercases", () => {
  assert.equal(normalizeMimeType(" Image/JPEG "), "image/jpeg");
  assert.equal(normalizeMimeType(""), null);
  assert.equal(normalizeMimeType(undefined), null);
});
