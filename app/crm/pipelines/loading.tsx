import { Skeleton } from "@/components/ui/skeleton";

export default function CrmPipelinesLoading() {
  return (
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-3 pb-2 pt-3 md:gap-4 md:px-4 md:pt-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-96 max-w-[80vw]" />
        </div>
      </div>
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3 md:px-4 md:pb-4">
        <Skeleton className="h-4 w-80 max-w-[70vw]" />
        <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-3 2xl:grid-cols-4">
          <Skeleton className="h-full min-h-[280px] rounded-[22px]" />
          <Skeleton className="h-full min-h-[280px] rounded-[22px]" />
          <Skeleton className="h-full min-h-[280px] rounded-[22px]" />
          <Skeleton className="h-full min-h-[280px] rounded-[22px] 2xl:block hidden" />
        </div>
      </section>
    </section>
  );
}
