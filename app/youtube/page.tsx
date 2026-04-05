import { PageHeader } from "@/components/page-header";
import { YouTubeClient } from "./youtube-client";

export default function YouTubePage() {
  return (
    <div className="flex-1">
      <PageHeader
        title="YouTube Manager"
        description="Plan, script, and track your YouTube content pipeline"
      />
      <YouTubeClient />
    </div>
  );
}
