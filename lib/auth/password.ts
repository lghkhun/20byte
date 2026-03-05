import bcrypt from "bcryptjs";

const BCRYPT_SALT_ROUNDS = 12;
const BCRYPT_MAX_BYTES = 72;
const MIN_PASSWORD_LENGTH = 8;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function validatePasswordPolicy(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return "Password must be at least 8 characters.";
  }

  if (Buffer.byteLength(password, "utf8") > BCRYPT_MAX_BYTES) {
    return "Password is too long.";
  }

  return null;
}

