import { PrismaClient } from "@prisma/client";

import { seedBusiness } from "@/scripts/seed/seedBusiness";
import { seedCore } from "@/scripts/seed/seedCore";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "DemoPass123!";

async function main() {
  await seedCore({ prisma, demoPassword: DEMO_PASSWORD });
  await seedBusiness({ prisma, demoPassword: DEMO_PASSWORD });

  console.log("Seed completed.");
  console.log("Demo users:");
  console.log("- owner@seed.20byte.local / DemoPass123!");
  console.log("- admin@seed.20byte.local / DemoPass123!");
  console.log("- cs@seed.20byte.local / DemoPass123!");
  console.log("- advertiser@seed.20byte.local / DemoPass123!");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
