const panelTitles = ["Conversation List", "Chat Workspace", "CRM Context"];

export default function HomePage() {
  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Foundation Ready</h1>
        <p className="text-sm text-muted-foreground">
          Base layout, design tokens, and platform structure are prepared for incremental MVP work.
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-3">
        {panelTitles.map((title) => (
          <article key={title} className="rounded-xl border border-border bg-surface/70 p-4">
            <h2 className="text-sm font-medium text-foreground">{title}</h2>
            <div className="mt-3 space-y-2">
              <div className="h-3 w-2/3 rounded bg-muted" />
              <div className="h-3 w-full rounded bg-muted" />
              <div className="h-3 w-4/5 rounded bg-muted" />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
