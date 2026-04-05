import { prisma } from "@/lib/db/prisma";
import { getPrimaryOrganizationForUser } from "@/server/services/organizationService";

type OwnerOnboardingStepId =
  | "business_profile"
  | "whatsapp_connection"
  | "meta_tracking"
  | "payment_account"
  | "profile_account"
  | "team_setup";

export type OwnerOnboardingStep = {
  id: OwnerOnboardingStepId;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  completed: boolean;
  missingItems: string[];
};

export type OwnerOnboardingStatus = {
  orgId: string;
  orgName: string;
  totalSteps: number;
  completedSteps: number;
  completionPercent: number;
  isComplete: boolean;
  readinessLabel: string;
  nextRequiredStep: OwnerOnboardingStep | null;
  steps: OwnerOnboardingStep[];
};

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

export async function getOwnerOnboardingStatus(userId: string): Promise<OwnerOnboardingStatus | null> {
  const primaryOrganization = await getPrimaryOrganizationForUser(userId);
  if (!primaryOrganization || primaryOrganization.role !== "OWNER") {
    return null;
  }

  const [organization, bankAccountCount, waAccountCount, ownerProfile, memberCount, metaIntegration] = await Promise.all([
    prisma.org.findUnique({
      where: { id: primaryOrganization.id },
      select: {
        id: true,
        name: true,
        responsibleName: true,
        businessPhone: true,
        businessAddress: true
      }
    }),
    prisma.orgBankAccount.count({
      where: { orgId: primaryOrganization.id }
    }),
    prisma.waAccount.count({
      where: { orgId: primaryOrganization.id }
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        phoneE164: true
      }
    }),
    prisma.orgMember.count({
      where: { orgId: primaryOrganization.id }
    }),
    prisma.metaIntegration.findUnique({
      where: { orgId: primaryOrganization.id },
      select: {
        pixelId: true,
        accessTokenEnc: true,
        isEnabled: true
      }
    })
  ]);

  if (!organization) {
    return null;
  }

  const missingBusinessItems: string[] = [];
  if (!hasText(organization.name)) {
    missingBusinessItems.push("Nama bisnis");
  }
  if (!hasText(organization.responsibleName)) {
    missingBusinessItems.push("Nama penanggung jawab");
  }
  if (!hasText(organization.businessPhone)) {
    missingBusinessItems.push("Nomor WhatsApp bisnis");
  }
  if (!hasText(organization.businessAddress)) {
    missingBusinessItems.push("Alamat bisnis");
  }

  const metaReady = Boolean(
    metaIntegration?.isEnabled &&
      hasText(metaIntegration.pixelId) &&
      hasText(metaIntegration.accessTokenEnc)
  );

  const steps: OwnerOnboardingStep[] = [
    {
      id: "business_profile",
      title: "Lengkapi profil bisnis",
      description: "Lengkapi informasi dasar bisnis agar akun terlihat lebih rapi dan mudah dikenali.",
      href: "/settings?tab=business",
      ctaLabel: "Lengkapi profil bisnis",
      completed: missingBusinessItems.length === 0,
      missingItems: missingBusinessItems
    },
    {
      id: "whatsapp_connection",
      title: "Hubungkan WhatsApp",
      description: "Sambungkan nomor WhatsApp utama agar percakapan masuk ke inbox dan siap ditangani lebih cepat.",
      href: "/settings?tab=whatsapp",
      ctaLabel: "Hubungkan WhatsApp",
      completed: waAccountCount > 0,
      missingItems: waAccountCount > 0 ? [] : ["Nomor WhatsApp utama belum terhubung."]
    },
    {
      id: "meta_tracking",
      title: "Setup Meta Pixel & CAPI",
      description: "Hubungkan Meta Pixel & CAPI agar hasil kampanye bisa tercatat lebih rapi di platform.",
      href: "/settings?tab=shortlinks",
      ctaLabel: "Buka pengaturan Meta",
      completed: metaReady,
      missingItems: metaReady ? [] : ["Meta Pixel & CAPI belum siap digunakan."]
    },
    {
      id: "payment_account",
      title: "Tambahkan rekening pembayaran",
      description: "Simpan rekening bisnis agar pembuatan invoice lebih praktis saat dibutuhkan.",
      href: "/settings?tab=business",
      ctaLabel: "Tambah rekening bisnis",
      completed: bankAccountCount > 0,
      missingItems: bankAccountCount > 0 ? [] : ["Belum ada rekening bisnis yang disimpan."]
    },
    {
      id: "profile_account",
      title: "Lengkapi profil akun",
      description: "Tambahkan nama dan nomor aktif agar akun lebih mudah dikenali.",
      href: "/settings/profile",
      ctaLabel: "Lengkapi profil akun",
      completed: hasText(ownerProfile?.name) && hasText(ownerProfile?.phoneE164),
      missingItems: hasText(ownerProfile?.name) && hasText(ownerProfile?.phoneE164) ? [] : ["Profil belum lengkap."]
    },
    {
      id: "team_setup",
      title: "Undang anggota tim",
      description: "Tambahkan anggota tim jika pengelolaan chat dan pelanggan dikerjakan bersama.",
      href: "/settings?tab=team",
      ctaLabel: "Atur anggota tim",
      completed: memberCount > 1,
      missingItems: memberCount > 1 ? [] : ["Belum ada anggota tim lain yang bergabung."]
    }
  ];

  const completedSteps = steps.filter((step) => step.completed).length;
  const totalSteps = steps.length;
  const completionPercent = Math.round((completedSteps / totalSteps) * 100);
  const isComplete = completedSteps === totalSteps;
  const nextRequiredStep = steps.find((step) => !step.completed) ?? null;

  return {
    orgId: organization.id,
    orgName: organization.name,
    totalSteps,
    completedSteps,
    completionPercent,
    isComplete,
    readinessLabel: isComplete ? "Akun Anda sudah siap digunakan." : `${completedSteps} dari ${totalSteps} langkah utama sudah selesai.`,
    nextRequiredStep,
    steps
  };
}
