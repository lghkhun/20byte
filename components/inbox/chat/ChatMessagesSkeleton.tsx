export function ChatMessagesSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className={index % 2 === 0 ? "flex justify-start" : "flex justify-end"}>
          <div className="w-[58%] rounded-2xl border border-border/60 bg-card/75 p-3 shadow-sm">
            <div className="inbox-shimmer h-3 w-5/6 rounded" />
            <div className="mt-2 inbox-shimmer h-3 w-2/3 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
