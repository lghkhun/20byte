function LoadingBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-muted/70 ${className}`} />;
}

export default function AppLoading() {
  return (
    <section className="flex h-full min-h-0 flex-1 overflow-hidden p-2 md:p-4">
      <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[28px] border border-border/80 bg-surface/90 p-5 shadow-[0_20px_60px_hsl(var(--foreground)/0.06)] backdrop-blur">
        <div className="space-y-5">
          <div className="rounded-[24px] border border-border/70 bg-card/95 px-6 py-5 shadow-sm">
            <LoadingBlock className="h-8 w-48" />
            <LoadingBlock className="mt-3 h-4 w-[28rem] max-w-full" />
          </div>

          <div className="grid gap-4 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-[24px] border border-border/70 bg-card/95 p-6 shadow-sm">
                <LoadingBlock className="h-4 w-24" />
                <LoadingBlock className="mt-4 h-10 w-20" />
                <LoadingBlock className="mt-4 h-6 w-28" />
              </div>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,0.83fr)]">
            <div className="rounded-[24px] border border-border/70 bg-card/95 p-6 shadow-sm">
              <LoadingBlock className="h-7 w-52" />
              <LoadingBlock className="mt-2 h-4 w-24" />
              <LoadingBlock className="mt-8 h-[320px] w-full" />
            </div>
            <div className="rounded-[24px] border border-border/70 bg-card/95 p-6 shadow-sm">
              <LoadingBlock className="h-7 w-44" />
              <LoadingBlock className="mt-2 h-4 w-36" />
              <div className="mt-6 space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <LoadingBlock key={index} className="h-16 w-full" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
