export default function DashboardLoading() {
  return (
    <section className="space-y-6 p-4 md:p-6">
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded bg-muted/80" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`dashboard-loading-card-${index}`} className="rounded-2xl border border-border/70 bg-card/70 p-4">
            <div className="h-3 w-24 animate-pulse rounded bg-muted/80" />
            <div className="mt-3 h-7 w-32 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-3 w-20 animate-pulse rounded bg-muted/70" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-64 animate-pulse rounded-xl bg-muted/70" />
      </div>
    </section>
  );
}
