import { PageHeader } from "@/components/page-header";
import { YouTubeClient } from "../youtube/youtube-client";
import { YT_CHANNELS } from "@/lib/yt-channels";

export default function YouTubeSeoPage() {
  const cfg = YT_CHANNELS.seo;
  return (
    <div className="flex-1">
      <PageHeader
        title="YouTube SEO Manager"
        description={`${cfg.brand} · ${cfg.handle} — local SEO for Australian tradies. Plan, script, and track your content pipeline.`}
      />
      <YouTubeClient channel="seo" />
    </div>
  );
}
