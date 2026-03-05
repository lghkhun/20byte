import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaUrl: string | undefined;
};

function resolveDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  if (process.env.NODE_ENV !== "production") {
    return "mysql://root:password@localhost:3307/20byte";
  }

  return undefined;
}

const resolvedDatabaseUrl = resolveDatabaseUrl();
const shouldRecreateClient = !globalForPrisma.prisma || globalForPrisma.prismaUrl !== resolvedDatabaseUrl;

if (shouldRecreateClient) {
  globalForPrisma.prisma = new PrismaClient({
    ...(resolvedDatabaseUrl
      ? {
          datasources: {
            db: {
              url: resolvedDatabaseUrl
            }
          }
        }
      : {}),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });
  globalForPrisma.prismaUrl = resolvedDatabaseUrl;
}

export const prisma = globalForPrisma.prisma as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaUrl = resolvedDatabaseUrl;
}
