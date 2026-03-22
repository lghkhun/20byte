import { ShortlinkManager } from "@/components/settings/ShortlinkManager";

export default function ShortlinksPage() {
  return (
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden p-3 md:p-5">
      <div className="inbox-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pr-1">
        <ShortlinkManager variant="page" />
      </div>
    </section>
  );
}
