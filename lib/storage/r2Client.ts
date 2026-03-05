import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

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

  return `${config.publicUrl}/${input.objectKey}`;
}

