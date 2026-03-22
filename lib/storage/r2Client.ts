import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
};

let cachedClient: S3Client | null = null;
let cachedConfig: R2Config | null = null;

function requiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value.trim();
}

function getR2Config(): R2Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  const publicUrlRaw = requiredEnv("R2_PUBLIC_URL");
  cachedConfig = {
    accountId: requiredEnv("R2_ACCOUNT_ID"),
    accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    bucket: requiredEnv("R2_BUCKET"),
    publicUrl: publicUrlRaw.replace(/\/+$/, "")
  };

  return cachedConfig;
}

function getR2Client(): S3Client {
  if (cachedClient) {
    return cachedClient;
  }

  const config = getR2Config();
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });

  return cachedClient;
}

type UploadToR2Input = {
  objectKey: string;
  body: Buffer;
  contentType?: string;
};

export async function uploadToR2(input: UploadToR2Input): Promise<string> {
  const client = getR2Client();
  const config = getR2Config();

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: input.objectKey,
      Body: input.body,
      ContentType: input.contentType
    })
  );

  return getProxyAssetUrl(input.objectKey);
}

export async function deleteFromR2(objectKey: string): Promise<void> {
  const normalized = objectKey.trim();
  if (!normalized) {
    return;
  }

  const client = getR2Client();
  const config = getR2Config();
  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: normalized
    })
  );
}

export function getPublicObjectKeyFromUrl(fileUrl: string): string | null {
  const normalized = fileUrl.trim();
  if (!normalized) {
    return null;
  }

  const proxyPrefix = "/api/storage/public/";
  if (normalized.startsWith(proxyPrefix)) {
    const objectKey = decodeURIComponent(normalized.slice(proxyPrefix.length)).trim();
    return objectKey || null;
  }

  const config = getR2Config();
  const prefix = `${config.publicUrl}/`;
  if (!normalized.startsWith(prefix)) {
    try {
      const parsed = new URL(normalized);
      if (parsed.pathname.startsWith(proxyPrefix)) {
        const objectKeyFromPath = decodeURIComponent(parsed.pathname.slice(proxyPrefix.length)).trim();
        return objectKeyFromPath || null;
      }

      const configuredOrigin = new URL(config.publicUrl).origin;
      const isKnownR2Origin =
        parsed.origin === configuredOrigin ||
        parsed.hostname.endsWith(".r2.cloudflarestorage.com") ||
        parsed.hostname.endsWith(".r2.dev");
      if (!isKnownR2Origin) {
        return null;
      }

      const objectKeyFromPublic = decodeURIComponent(parsed.pathname.replace(/^\/+/, "")).trim();
      return objectKeyFromPublic || null;
    } catch {
      return null;
    }
  }

  const objectKey = normalized.slice(prefix.length).trim();
  return objectKey || null;
}

export function getProxyAssetUrl(objectKey: string): string {
  return `/api/storage/public/${encodeURIComponent(objectKey)}`;
}

export async function getObjectFromR2(objectKeyInput: string): Promise<{
  body: Uint8Array;
  contentType: string | null;
  cacheControl: string | null;
}> {
  const objectKey = objectKeyInput.trim();
  if (!objectKey) {
    throw new Error("objectKey is required");
  }

  const client = getR2Client();
  const config = getR2Config();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: objectKey
    })
  );

  const body = await response.Body?.transformToByteArray();
  if (!body) {
    throw new Error("Object body is empty.");
  }

  return {
    body,
    contentType: response.ContentType ?? null,
    cacheControl: response.CacheControl ?? null
  };
}
