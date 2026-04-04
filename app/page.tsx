"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import {
  MessageSquare,
  Users,
  Database,
  ArrowRight,
  CheckCircle2,
  Zap,
  Shield,
  BarChart3,
  Send,
  UserPlus,
  Receipt,
  Target,
  LineChart,
  MousePointerClick,
  Activity,
  FileText,
  TrendingUp,
  ChevronDown,
} from "lucide-react";

/* ═══════════════════════════════════════════════════
   Intersection‑Observer scroll‑reveal
   ═══════════════════════════════════════════════════ */
function useReveal() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); } }),
      { threshold: 0.08, rootMargin: "0px 0px -60px 0px" }
    );
    el.querySelectorAll("[data-reveal]").forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);
  return root;
}

/* ── Animated counter ── */
function Counter({ to, suffix, label }: { to: number; suffix: string; label: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const ran = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || ran.current) return;
      ran.current = true;
      const dur = 1400, t0 = performance.now();
      (function tick(now: number) {
        const p = Math.min((now - t0) / dur, 1);
        const v = Math.floor((1 - Math.pow(1 - p, 4)) * to);
        el.textContent = `${v}${suffix}`;
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
      io.unobserve(el);
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [to, suffix]);
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5 py-10">
      <span ref={ref} className="tabular-nums text-3xl font-bold text-foreground sm:text-4xl">0{suffix}</span>
      <span className="text-[13px] text-muted-foreground">{label}</span>
    </div>
  );
}

/* ── Reveal wrapper ── */
function R({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return <div data-reveal className={`reveal-up ${className}`} style={delay ? { transitionDelay: `${delay}ms` } as React.CSSProperties : undefined}>{children}</div>;
}

/* ═══════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════ */
export default function HomePage() {
  const pageRef = useReveal();

  return (
    <div ref={pageRef} className="lp">

      {/* ○ decorative ambient blobs — positioned on the page, NOT per‑section */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-[20%] left-[10%] h-[800px] w-[800px] rounded-full bg-primary/[0.07] blur-[200px]" />
        <div className="absolute right-[5%] top-[35%] h-[600px] w-[600px] rounded-full bg-teal-500/[0.04] blur-[180px]" />
        <div className="absolute bottom-[10%] left-[30%] h-[700px] w-[700px] rounded-full bg-primary/[0.05] blur-[190px]" />
      </div>

      {/* ━━━━━━━━━━━━━ HERO ━━━━━━━━━━━━━ */}
      <section className="flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center px-5 pt-14 md:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <R>
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.06] px-4 py-1.5 text-[13px] font-medium text-primary">
              <Zap className="h-3.5 w-3.5" /> WhatsApp CRM All‑in‑One
            </span>
          </R>

          <R delay={60}>
            <h1 className="mt-2 text-[2.5rem] font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl md:text-6xl">
              Semua operasi bisnis,
              <br />
              <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
                satu dashboard WhatsApp.
              </span>
            </h1>
          </R>

          <R delay={120}>
            <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-base md:text-lg">
              Terima chat, kelola pipeline, simpan data pelanggan, kirim invoice,
              dan lacak iklan CTWA — tanpa buka 5 tab berbeda.
            </p>
          </R>

          <R delay={200}>
            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
              <Link
                href="/register"
                id="hero-cta-register"
                className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-[0_4px_24px_hsl(160_84%_39%/0.35)] transition-all duration-300 hover:shadow-[0_6px_32px_hsl(160_84%_39%/0.5)] hover:brightness-110 active:scale-[0.98] sm:w-auto"
              >
                Coba Gratis 14 Hari
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                id="hero-cta-login"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-border/50 bg-card/30 px-7 text-sm font-semibold text-foreground backdrop-blur transition-all duration-300 hover:border-border hover:bg-card/60 active:scale-[0.98] sm:w-auto"
              >
                Masuk ke Dashboard
              </Link>
            </div>
          </R>

          <R delay={280}>
            <p className="mt-6 flex items-center justify-center gap-2 text-[13px] text-muted-foreground/70">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary/70" />
              Tanpa kartu kredit &middot; Setup 5 menit &middot; Bisa batal kapan saja
            </p>
          </R>
        </div>

        <div className="mt-auto pb-8 pt-12">
          <ChevronDown className="mx-auto h-5 w-5 animate-bounce text-muted-foreground/30" />
        </div>
      </section>

      {/* ━━━━━━━━━━━━━ FEATURES ━━━━━━━━━━━━━ */}
      <section id="features" className="px-5 py-28 md:px-8 md:py-36">
        <div className="mx-auto max-w-6xl">
          <R>
            <div className="mb-16 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Fitur Utama</p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
                Empat pilar untuk menjalankan bisnis WhatsApp
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
                Setiap fitur dirancang agar saling terhubung — dari chat pertama hingga invoice lunas.
              </p>
            </div>
          </R>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                {
                  icon: MessageSquare,
                  title: "Team Inbox",
                  body: "Semua chat WhatsApp masuk ke satu inbox bersama. Assign percakapan ke CS, tinggalkan internal notes, dan balas dengan template — real‑time tanpa bentrok.",
                },
                {
                  icon: BarChart3,
                  title: "CRM Pipeline",
                  body: "Board visual untuk memindahkan deal antar stage. Lihat total revenue di setiap stage dan pastikan tidak ada follow‑up yang terlewat.",
                },
                {
                  icon: Database,
                  title: "Database Kontak",
                  body: "Setiap kontak punya profil lengkap: riwayat chat, catatan tim, tag, dan timeline aktivitas. Filter untuk segmentasi atau broadcast.",
                },
                {
                  icon: Receipt,
                  title: "Invoice & Penagihan",
                  body: "Buat invoice profesional, kirim langsung di chat WhatsApp, dan terima bukti transfer dari pelanggan — semuanya tercatat otomatis.",
                },
              ] as const
            ).map((f, i) => (
              <R key={f.title} delay={i * 80}>
                <article className="group relative h-full overflow-hidden rounded-2xl border border-border/[0.15] bg-card/[0.35] p-6 backdrop-blur-sm transition-all duration-500 hover:-translate-y-1 hover:border-primary/20 hover:bg-card/60 hover:shadow-[0_16px_48px_-8px_hsl(var(--primary)/0.08)]">
                  <div className="mb-4 inline-flex rounded-xl bg-primary/[0.08] p-3 text-primary transition-transform duration-500 group-hover:scale-110">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-2 text-[15px] font-semibold text-foreground">{f.title}</h3>
                  <p className="text-[13px] leading-[1.6] text-muted-foreground">{f.body}</p>
                </article>
              </R>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━ CTWA · CAPI · PIXEL ━━━━━━━━━━━━━ */}
      <section id="ctwa-integration" className="px-5 py-28 md:px-8 md:py-36">
        <div className="mx-auto max-w-6xl">
          <R>
            <div className="mb-16 text-center">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                <Target className="h-3.5 w-3.5" /> Keunggulan Utama
              </p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
                Iklan → Chat → Invoice → Data balik ke Meta
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
                Platform pertama yang menghubungkan Click‑to‑WhatsApp Ads langsung ke pipeline CRM
                dan sistem invoice — dengan full‑loop tracking via Meta Conversions API dan Pixel.
              </p>
            </div>
          </R>

          <div className="grid gap-5 md:grid-cols-3">
            {(
              [
                {
                  icon: MousePointerClick,
                  title: "CTWA Attribution",
                  accent: "blue",
                  desc: "Setiap shortlink CTWA membawa metadata campaign, adset, dan ad ID. Begitu pelanggan chat, sumber lead langsung muncul di profil kontak.",
                  items: ["Shortlink unik per ad", "Auto‑tag campaign di kontak", "Attribution dashboard real‑time"],
                },
                {
                  icon: Activity,
                  title: "Meta Conversions API",
                  accent: "emerald",
                  desc: "Invoice berubah status? Event langsung dikirim ke Meta server‑side — tidak terpengaruh ad blocker atau pembatasan iOS.",
                  items: ["Server‑side, tanpa cookie blocker", "Invoice → Purchase event otomatis", "Deduplikasi otomatis dengan Pixel"],
                },
                {
                  icon: LineChart,
                  title: "Meta Pixel",
                  accent: "violet",
                  desc: "Halaman invoice publik sudah terpasang Pixel. Tiap kali pelanggan buka atau bayar, data masuk ke Meta untuk retargeting.",
                  items: ["Pixel di halaman invoice publik", "ViewContent → Purchase funnel", "Custom audience dari pembeli"],
                },
              ] as const
            ).map((c, i) => {
              const accentMap = {
                blue: { icon: "bg-blue-500/10 text-blue-500", check: "text-blue-500", border: "hover:border-blue-500/20" },
                emerald: { icon: "bg-primary/10 text-primary", check: "text-primary", border: "hover:border-primary/20" },
                violet: { icon: "bg-violet-500/10 text-violet-500", check: "text-violet-500", border: "hover:border-violet-500/20" },
              };
              const a = accentMap[c.accent];
              return (
                <R key={c.title} delay={i * 100}>
                  <div className={`group relative h-full overflow-hidden rounded-2xl border border-border/[0.15] bg-card/[0.35] p-7 backdrop-blur-sm transition-all duration-500 hover:-translate-y-1 hover:bg-card/60 hover:shadow-[0_16px_48px_-8px_rgba(0,0,0,0.06)] ${a.border}`}>
                    <div className={`mb-5 inline-flex rounded-xl p-3 transition-transform duration-500 group-hover:scale-110 ${a.icon}`}>
                      <c.icon className="h-6 w-6" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-foreground">{c.title}</h3>
                    <p className="mb-5 text-[13px] leading-[1.6] text-muted-foreground">{c.desc}</p>
                    <ul className="space-y-2.5">
                      {c.items.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-[13px] text-muted-foreground">
                          <CheckCircle2 className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${a.check}`} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </R>
              );
            })}
          </div>

          {/* attribution flow */}
          <R>
            <div className="mt-10 rounded-2xl border border-border/[0.1] bg-card/[0.2] px-6 py-8 backdrop-blur-sm md:px-10 md:py-10">
              <p className="mb-8 text-center text-[13px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                End‑to‑End Attribution Flow
              </p>
              <div className="flex flex-col items-center gap-3 md:flex-row md:justify-center md:gap-0">
                {(
                  [
                    { icon: MousePointerClick, label: "Klik CTWA Ad", cls: "text-blue-500 bg-blue-500/10 border-blue-500/15" },
                    { icon: MessageSquare, label: "Masuk Inbox", cls: "text-primary bg-primary/10 border-primary/15" },
                    { icon: Users, label: "Pipeline CRM", cls: "text-primary bg-primary/10 border-primary/15" },
                    { icon: Receipt, label: "Invoice Terkirim", cls: "text-amber-500 bg-amber-500/10 border-amber-500/15" },
                    { icon: Activity, label: "CAPI Event", cls: "text-violet-500 bg-violet-500/10 border-violet-500/15" },
                    { icon: TrendingUp, label: "Optimize Ads", cls: "text-blue-500 bg-blue-500/10 border-blue-500/15" },
                  ] as const
                ).map((s, i, arr) => (
                  <div key={s.label} className="flow-node flex items-center gap-3 md:gap-0" style={{ "--d": `${i * 100}ms` } as React.CSSProperties}>
                    <div className={`flex flex-col items-center gap-2 rounded-xl border px-5 py-3 transition-transform duration-300 hover:scale-105 ${s.cls}`}>
                      <s.icon className="h-5 w-5" />
                      <span className="whitespace-nowrap text-[10px] font-semibold">{s.label}</span>
                    </div>
                    {i < arr.length - 1 && (
                      <>
                        <ArrowRight className="flow-arrow mx-1.5 hidden h-3.5 w-3.5 text-muted-foreground/25 md:block" />
                        <ArrowRight className="flow-arrow h-3.5 w-3.5 rotate-90 text-muted-foreground/25 md:hidden" />
                      </>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-8 text-center text-[13px] leading-relaxed text-muted-foreground/70">
                Dari klik iklan sampai pembayaran lunas — setiap konversi tersambung dan
                terkirim balik ke Meta untuk optimasi campaign otomatis.
              </p>
            </div>
          </R>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━ HOW IT WORKS ━━━━━━━━━━━━━ */}
      <section className="px-5 py-28 md:px-8 md:py-36">
        <div className="mx-auto max-w-4xl">
          <R>
            <div className="mb-16 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Cara Kerja</p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
                Tiga langkah, langsung jalan
              </h2>
              <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">
                Tidak perlu developer, tidak perlu integrasi rumit.
              </p>
            </div>
          </R>

          <div className="relative grid gap-10 md:grid-cols-3 md:gap-8">
            {/* connector line (desktop) */}
            <div aria-hidden className="pointer-events-none absolute left-[16.66%] right-[16.66%] top-8 hidden h-px bg-gradient-to-r from-transparent via-border/50 to-transparent md:block" />

            {(
              [
                { icon: UserPlus, n: "01", title: "Daftar & Hubungkan", body: "Buat akun, scan QR code, dan nomor WhatsApp Business Anda langsung terhubung dalam 2 menit." },
                { icon: Users, n: "02", title: "Atur Tim & Pipeline", body: "Undang anggota tim, tentukan role masing‑masing, dan konfigurasi stage pipeline sesuai alur bisnis Anda." },
                { icon: Send, n: "03", title: "Mulai Closing", body: "Terima chat, geser deal antar stage, kirim invoice, dan pantau performa — semua dari satu layar." },
              ] as const
            ).map((s, i) => (
              <R key={s.n} delay={i * 100}>
                <div className="group relative flex flex-col items-center text-center">
                  <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/[0.06] text-primary transition-all duration-500 group-hover:scale-110 group-hover:bg-primary/[0.12] group-hover:shadow-[0_8px_24px_hsl(160_84%_39%/0.12)]">
                    <s.icon className="h-7 w-7" />
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{s.n}</span>
                  </div>
                  <h3 className="mb-2 text-[15px] font-semibold text-foreground">{s.title}</h3>
                  <p className="max-w-[260px] text-[13px] leading-[1.6] text-muted-foreground">{s.body}</p>
                </div>
              </R>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━ STATS ━━━━━━━━━━━━━ */}
      <section className="px-5 py-16 md:px-8 md:py-20">
        <R>
          <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-border/[0.12] bg-card/[0.2] backdrop-blur-sm">
            <div className="grid grid-cols-2 divide-x divide-border/[0.12] md:grid-cols-4">
              <Counter to={5} suffix="K+" label="Chat diproses / hari" />
              <Counter to={98} suffix="%" label="Response rate" />
              <Counter to={3} suffix="x" label="Lebih cepat closing" />
              <Counter to={500} suffix="+" label="Bisnis aktif" />
            </div>
          </div>
        </R>
      </section>

      {/* ━━━━━━━━━━━━━ WHY 20BYTE ━━━━━━━━━━━━━ */}
      <section className="px-5 py-28 md:px-8 md:py-36">
        <div className="mx-auto max-w-5xl">
          <div className="grid items-start gap-14 md:grid-cols-2 md:gap-20">
            <R>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Kenapa 20byte</p>
                <h2 className="mt-3 text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl md:text-4xl">
                  Dibangun khusus untuk bisnis yang hidup di WhatsApp
                </h2>
                <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">
                  Cukup buka satu tab. Seluruh percakapan, data pelanggan, invoice, dan
                  performa iklan CTWA ada di satu tempat — tanpa copy‑paste antar aplikasi.
                </p>
              </div>
            </R>

            <div className="space-y-2">
              {(
                [
                  { icon: Shield, title: "Multi‑agent dengan role guard", desc: "Owner, Admin, CS, Advertiser — tiap role punya akses yang tepat. Tidak ada chat yang bentrok." },
                  { icon: Zap, title: "Notifikasi instan", desc: "Pesan masuk langsung muncul di inbox. Tidak ada lead yang hilang karena telat respons." },
                  { icon: FileText, title: "Invoice langsung dari chat", desc: "Generate invoice, kirim link pembayaran, pelanggan bayar — bukti transfer masuk otomatis ke timeline." },
                  { icon: BarChart3, title: "Full‑funnel attribution", desc: "Klik CTWA → chat → deal → invoice PAID — seluruh perjalanan pelanggan terukur dan terhubung." },
                ] as const
              ).map((b, i) => (
                <R key={b.title} delay={i * 80}>
                  <div className="group flex gap-4 rounded-xl p-4 transition-all duration-300 hover:bg-card/40">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/[0.06] text-primary transition-all duration-500 group-hover:scale-110 group-hover:bg-primary/[0.12]">
                      <b.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-[14px] font-semibold text-foreground">{b.title}</h3>
                      <p className="mt-1 text-[13px] leading-[1.6] text-muted-foreground">{b.desc}</p>
                    </div>
                  </div>
                </R>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━ CTA ━━━━━━━━━━━━━ */}
      <section className="px-5 py-28 md:px-8 md:py-36">
        <R>
          <div className="mx-auto max-w-2xl text-center">
            <div className="rounded-3xl border border-primary/10 bg-gradient-to-b from-primary/[0.04] to-transparent px-8 py-14 backdrop-blur-sm md:px-14 md:py-20">
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
                Siap mengelola bisnis lebih efisien?
              </h2>
              <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
                Ratusan bisnis sudah beralih ke 20byte. Mulai trial gratis —
                tanpa kartu kredit, tanpa kontrak.
              </p>
              <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
                <Link
                  href="/register"
                  id="cta-register"
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-[0_4px_24px_hsl(160_84%_39%/0.35)] transition-all duration-300 hover:shadow-[0_6px_32px_hsl(160_84%_39%/0.5)] hover:brightness-110 active:scale-[0.98] sm:w-auto"
                >
                  Daftar Sekarang — Gratis
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  id="cta-login"
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-border/50 bg-card/30 px-8 text-sm font-semibold text-foreground backdrop-blur transition-all duration-300 hover:border-border hover:bg-card/60 active:scale-[0.98] sm:w-auto"
                >
                  Sudah punya akun? Masuk
                </Link>
              </div>
            </div>
          </div>
        </R>
      </section>

      {/* ━━━━━━━━━━━━━ FOOTER ━━━━━━━━━━━━━ */}
      <footer className="border-t border-border/[0.08] px-5 py-10 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold tracking-tight text-foreground">20byte</span>
            <span className="text-xs text-muted-foreground/50">© {new Date().getFullYear()}</span>
          </div>
          <nav className="flex items-center gap-6 text-[13px] text-muted-foreground/60">
            <a href="#features" className="transition-colors hover:text-foreground">Fitur</a>
            <a href="#ctwa-integration" className="transition-colors hover:text-foreground">CTWA & CAPI</a>
            <Link href="/login" className="transition-colors hover:text-foreground">Masuk</Link>
            <Link href="/register" className="transition-colors hover:text-foreground">Daftar</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
