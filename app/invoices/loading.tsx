import { Skeleton } from "@/components/ui/skeleton";

export default function InvoicesLoading() {
  return (
    <section className="flex h-full min-h-0 flex-1 flex-col space-y-3 p-3 md:space-y-4 md:p-5">
      <div className="space-y-3 px-1 py-1 md:space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-96 max-w-[80vw]" />
          </div>
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
        <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
          <Skeleton className="h-[420px] w-full rounded-xl" />
        </div>
      </div>
    </section>
  );
}
