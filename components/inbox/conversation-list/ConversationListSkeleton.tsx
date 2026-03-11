export function ConversationListSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index} className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/70 p-3 shadow-sm">
          <div className="inbox-shimmer h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="inbox-shimmer h-3.5 w-2/5 rounded" />
            <div className="inbox-shimmer h-3 w-4/5 rounded" />
            <div className="inbox-shimmer h-2.5 w-1/4 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
