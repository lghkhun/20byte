export function ConversationListSkeleton() {
  return (
    <div className="flex flex-col divide-y divide-border/60 overflow-hidden">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="flex items-start gap-4 p-4 sm:p-5">
          {/* Avatar Skeleton */}
          <div className="inbox-shimmer h-12 w-12 shrink-0 rounded-full border border-border/40" />
          
          <div className="min-w-0 flex-1 space-y-3">
            {/* Name and Time Header */}
            <div className="flex items-center justify-between gap-4">
              <div className="inbox-shimmer h-4 w-1/3 rounded-lg" />
              <div className="inbox-shimmer h-3 w-12 rounded-full" />
            </div>
            
            {/* Message Preview */}
            <div className="inbox-shimmer h-3.5 w-[85%] rounded-lg" />
            
            {/* Badges/Indicators Footer */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex gap-2">
                <div className="inbox-shimmer h-4 w-16 rounded-lg" />
                <div className="inbox-shimmer h-4 w-12 rounded-lg" />
              </div>
              <div className="inbox-shimmer h-4 w-4 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
