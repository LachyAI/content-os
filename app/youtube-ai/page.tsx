import { PageHeader } from "@/components/page-header";
import { YouTubeClient } from "../youtube/youtube-client";
import { YT_CHANNELS } from "@/lib/yt-channels";

export default function YouTubeAiPage() {
  const cfg = YT_CHANNELS.ai;
  return (
    <div className="flex-1">
      <PageHeader
        title="YouTube AI Manager"
        description={`${cfg.brand} · ${cfg.handle} — AI automation & agency. Plan, script, and track your content pipeline.`}
      />
      <YouTubeClient channel="ai" />
    </div>
  );
}
