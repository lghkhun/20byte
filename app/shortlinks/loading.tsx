import { Skeleton } from "@/components/ui/skeleton";

export default function ShortlinksLoading() {
  return (
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden p-3 md:p-5">
      <div className="inbox-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pr-1">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96 max-w-[80vw]" />
            </div>
            <Skeleton className="h-10 w-36 rounded-xl" />
          </div>
          <Skeleton className="h-4 w-[28rem] max-w-[85vw]" />
          <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
            <Skeleton className="h-[420px] w-full rounded-xl" />
          </div>
        </div>
      </div>
    </section>
  );
}
