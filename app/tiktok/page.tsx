import { PageHeader } from "@/components/page-header";
import { TiktokClient } from "./tiktok-client";

export default function TiktokPage() {
  return (
    <div className="flex-1">
      <PageHeader
        title="TikTok"
        description="TikTok — posting schedule & pipeline"
      />
      <TiktokClient />
    </div>
  );
}
