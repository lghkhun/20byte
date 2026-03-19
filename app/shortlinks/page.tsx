import { ShortlinkManager } from "@/components/settings/ShortlinkManager";

export default function ShortlinksPage() {
  return (
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden p-3 md:p-5">
      <div className="inbox-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pr-1">
        <div className="rounded-[28px] border border-border/70 bg-card/95 p-5 shadow-sm">
          <ShortlinkManager variant="page" />
        </div>
      </div>
    </section>
  );
}
