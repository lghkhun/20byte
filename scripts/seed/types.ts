import type { PrismaClient } from "@prisma/client";

export type SeedContext = {
  prisma: PrismaClient;
  demoPassword: string;
};

export function toDate(value: string) {
  return new Date(value);
}

export function defaultBankAccountsJson() {
  return JSON.stringify([
    { bank: "BCA", no: "1234567890", holder: "20byte" },
    { bank: "Mandiri", no: "9988776655", holder: "20byte" }
  ]);
}
