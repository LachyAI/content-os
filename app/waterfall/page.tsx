import { PageHeader } from "@/components/page-header";
import { WaterfallClient } from "./waterfall-client";

export default function WaterfallPage() {
  return (
    <div className="flex-1">
      <PageHeader
        title="Content Waterfall"
        description="Turn one idea into content across every platform"
      />
      <WaterfallClient />
    </div>
  );
}
