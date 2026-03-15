export default function HomePage() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 py-8 md:py-14">
      <header className="space-y-4 text-center md:text-left">
        <p className="inline-flex rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          WhatsApp-first CRM for service business
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
          Kelola chat, CRM, invoice, dan payment proof dalam satu bisnis.
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
          20byte membantu tim owner, admin, dan CS bekerja dari inbox yang sama: assign conversation, kirim invoice,
          track payment proof, dan lihat attribution CTWA tanpa pindah-pindah tools.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-border bg-card/80 p-5">
          <h2 className="text-sm font-semibold text-foreground">Inbox Workspace</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Conversation list, chat window, CRM context, shortcut modal, dan role guard untuk operasi tim.
          </p>
        </article>
        <article className="rounded-2xl border border-border bg-card/80 p-5">
          <h2 className="text-sm font-semibold text-foreground">Invoice & Proof</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Flow DRAFT sampai PAID, milestone DP/FINAL, attach payment proof dari chat, dan timeline aktivitas.
          </p>
        </article>
        <article className="rounded-2xl border border-border bg-card/80 p-5">
          <h2 className="text-sm font-semibold text-foreground">CTWA Attribution</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Shortlink tracking campaign/adset/ad dan source metadata yang langsung tampil di conversation context.
          </p>
        </article>
      </div>

      <div className="rounded-2xl border border-border bg-surface/70 p-5">
        <h3 className="text-sm font-semibold text-foreground">Quick Start</h3>
        <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>1. Jalankan `docker compose up -d`</li>
          <li>2. Jalankan `npx prisma migrate dev`</li>
          <li>3. Jalankan `npm run db:seed`</li>
          <li>4. Login via `/login` dengan akun seed</li>
        </ol>
      </div>
    </section>
  );
}
