import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const VERSION = "v1";

function getCipherKey(): Buffer {
  const secret = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("Missing required environment variable: WHATSAPP_TOKEN_ENCRYPTION_KEY");
  }

  return createHash("sha256").update(secret).digest();
}

export function encryptSensitiveToken(plainText: string): string {
  if (!plainText) {
    throw new Error("Token value must not be empty.");
  }

  const key = getCipherKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${VERSION}.${iv.toString("base64url")}.${authTag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSensitiveToken(cipherText: string): string {
  const [version, ivPart, tagPart, encryptedPart] = cipherText.split(".");
  if (version !== VERSION || !ivPart || !tagPart || !encryptedPart) {
    throw new Error("Invalid encrypted token format.");
  }

  const key = getCipherKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  const plainBuffer = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final()
  ]);

  return plainBuffer.toString("utf8");
}
