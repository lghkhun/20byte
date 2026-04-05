import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Building2,
  Check,
  Landmark,
  MessageCircleMore,
  Rocket,
  ShieldCheck,
  UserCircle2,
  Users2
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type {
  OwnerOnboardingStatus,
  OwnerOnboardingStep
} from "@/server/services/onboardingService";

const STEP_ICONS: Record<OwnerOnboardingStep["id"], LucideIcon> = {
  business_profile: Building2,
  whatsapp_connection: MessageCircleMore,
  meta_tracking: ShieldCheck,
  payment_account: Landmark,
  profile_account: UserCircle2,
  team_setup: Users2
};

function StepTimeline({ steps }: { steps: OwnerOnboardingStep[] }) {
  const nextStepId = steps.find((step) => !step.completed)?.id ?? null;

  return (
    <div>
      <div className="space-y-3 md:hidden">
        {steps.map((step, index) => {
          const Icon = STEP_ICONS[step.id];
          const isCurrent = !step.completed && step.id === nextStepId;
          const isLast = index === steps.length - 1;

          return (
            <Link key={step.id} href={step.href} className="group relative flex items-start gap-4 rounded-xl p-3 hover:bg-muted/50 transition-colors">
              {!isLast ? <div className="absolute left-8 top-12 h-[calc(100%-1rem)] w-px bg-emerald-100 dark:bg-emerald-500/20" /> : null}
              <div
                className={cn(
                  "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-4 shadow-sm transition-transform group-hover:scale-105",
                  step.completed
                    ? "bg-emerald-600 text-white ring-emerald-50 dark:ring-emerald-500/10"
                    : isCurrent
                      ? "border-2 border-emerald-400 bg-emerald-50/50 text-emerald-700 ring-white dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500 dark:ring-background"
                      : "border border-border/70 bg-background text-muted-foreground ring-white dark:ring-background group-hover:border-emerald-300"
                )}
              >
                {step.completed ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <div className="pt-0.5">
                <p className="text-sm font-bold text-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">{step.title}</p>
                <p className={cn("mt-1 text-[11px] font-semibold uppercase tracking-widest", step.completed ? "text-emerald-600 dark:text-emerald-400" : isCurrent ? "text-emerald-700 dark:text-emerald-500" : "text-muted-foreground")}>
                  {step.completed ? "Tuntas" : isCurrent ? "Langkah Prioritas" : "Belum Diklaim"}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="relative hidden px-2 pt-2 md:block overflow-x-auto pb-4 scrollbar-thin">
        <div className="min-w-[850px] relative">
          <div className="absolute left-[7%] right-[7%] top-7 h-px bg-emerald-100 dark:bg-emerald-500/20" />
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
            {steps.map((step) => {
              const Icon = STEP_ICONS[step.id];
              const isCurrent = !step.completed && step.id === nextStepId;

              return (
                <Link key={step.id} href={step.href} className="group relative z-10 flex flex-col items-center text-center p-3 rounded-2xl hover:bg-muted/40 transition-colors">
                  <div
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full ring-4 shadow-sm transition-transform group-hover:-translate-y-1 group-hover:scale-105",
                      step.completed
                        ? "bg-emerald-600 text-white ring-white dark:ring-background"
                        : isCurrent
                          ? "border-2 border-emerald-400 bg-emerald-50 text-emerald-700 ring-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500 dark:ring-background"
                          : "border border-border/70 bg-card text-muted-foreground ring-white dark:ring-background group-hover:border-emerald-300"
                    )}
                  >
                    {step.completed ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <p className="mt-4 text-sm font-bold text-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">{step.title}</p>
                  <p className={cn("mt-1.5 text-[10px] font-semibold uppercase tracking-widest", step.completed ? "text-emerald-600 dark:text-emerald-400" : isCurrent ? "text-emerald-700 dark:text-emerald-500" : "text-muted-foreground")}>
                    {step.completed ? "Tuntas" : isCurrent ? "Langkah Prioritas" : "Belum Diklaim"}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}


export function SidebarOnboardingCard({ status }: { status: OwnerOnboardingStatus }) {
  const nextStep = status.nextRequiredStep;
  const remainingSteps = Math.max(0, status.totalSteps - status.completedSteps);

  return (
    <Link
      href="/onboarding"
      className="group block rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-background to-background p-4 shadow-[0_8px_20px_-12px_rgba(16,185,129,0.2)] transition-all hover:border-emerald-500/50 hover:shadow-[0_12px_24px_-12px_rgba(16,185,129,0.3)] group-data-[collapsible=icon]:hidden"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">Setup Workspace</p>
          <h3 className="mt-1 text-sm font-bold leading-tight text-foreground">{status.completionPercent}% tenaga optimal</h3>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
          {status.completedSteps}/{status.totalSteps}
        </div>
      </div>

      <Progress value={status.completionPercent} className="mt-3 h-2 bg-emerald-500/20 [&_[data-state]]:bg-emerald-500" />

      <p className="mt-3 text-[12px] font-medium leading-relaxed text-muted-foreground">
        {nextStep
          ? `Kurang ${remainingSteps} setelan krusial. Yuk eksekusi misi ${nextStep.title}!`
          : "Semua mesin menyala, workspace siap tempur!"}
      </p>

      <div className="mt-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
        <span>{status.isComplete ? "Siap Landas" : "Eksekusi Sekarang"}</span>
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

export function DashboardOnboardingBanner({ status }: { status: OwnerOnboardingStatus }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-extrabold tracking-tight text-foreground">Misi Workspace</h2>
            <Badge variant="secondary" className="rounded-full bg-emerald-500/15 py-0.5 px-2.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
              {status.completedSteps}/{status.totalSteps} Selesai
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Selesaikan setup awal untuk memastikan kelancaran operasional Anda.
          </p>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-5">
          <div className="text-right">
             <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-500">Progress</p>
             <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{status.completionPercent}%</p>
          </div>
          <div className="h-10 w-px bg-border hidden sm:block" />
          <Button asChild className="h-10 shrink-0 rounded-full px-5 hover:scale-105 transition-transform">
            <Link href="/onboarding">Lanjutkan Misi <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-5 sm:px-4">
        <StepTimeline steps={status.steps} />
      </div>
    </section>
  );
}

export function OwnerOnboardingPage({ status }: { status: OwnerOnboardingStatus }) {
  return (
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-6 lg:p-10">
      <div className="inbox-scroll mx-auto flex w-full max-w-5xl min-h-0 flex-1 flex-col gap-10 overflow-y-auto overscroll-contain pb-10 pr-2">
        
        {/* Header Sederhana */}
        <section className="flex flex-col items-center text-center lg:mt-8">
          <div className="inline-flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-6 ring-4 ring-emerald-500/5">
            <Rocket className="h-8 w-8 ml-1" />
          </div>
          <Badge variant="secondary" className="mb-4 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
             ROADMAP WORKSPACE ({status.completedSteps}/{status.totalSteps})
          </Badge>
          <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl lg:text-5xl">
            {status.isComplete ? "Workspace Siap Beraksi!" : "Perjalanan Menuju Launching"}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
            {status.isComplete
              ? `Konfigurasi dasar telah rampung. Nikmati arus kerja terpusat bersama tim.`
              : `Ikuti roadmap di bawah ini. Tahapan ini didesain sesimpel mungkin agar operasional harian Anda dapat berjalan maksimal tanpa jeda.`}
          </p>

          <div className="mt-8 flex w-full max-w-sm flex-col gap-2 rounded-2xl border border-border bg-card/60 p-4 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">Progress Keseluruhan</span>
              <span className="text-lg font-black text-emerald-600">{status.completionPercent}%</span>
            </div>
            <Progress value={status.completionPercent} className="h-2.5 bg-emerald-500/10 [&_[data-state]]:bg-emerald-500" />
            <p className="mt-1 text-xs font-medium text-muted-foreground">{status.readinessLabel}</p>
          </div>
        </section>

        {/* Roadmap Visual */}
        <section className="rounded-3xl border border-border bg-card/50 p-5 md:p-8 shadow-sm backdrop-blur-md">
          <h2 className="mb-6 text-center text-xl font-bold tracking-tight text-foreground sm:mb-8">Roadmap Lengkap Anda</h2>
          <StepTimeline steps={status.steps} />
        </section>
      </div>
    </section>
  );
}

export function OnboardingUnavailableState() {
  return (
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden p-3 md:p-5">
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="max-w-xl rounded-3xl border border-border/60 bg-card p-8 text-center shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Rocket className="h-5 w-5" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">Halaman ini belum tersedia untuk akun Anda.</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Jika ada informasi yang perlu diperbarui, Anda tetap bisa melanjutkan dari halaman profil atau pengaturan yang tersedia.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild className="h-11 rounded-xl">
              <Link href="/dashboard">
                Buka dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11 rounded-xl">
              <Link href="/settings/profile">
                Buka profil akun
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
