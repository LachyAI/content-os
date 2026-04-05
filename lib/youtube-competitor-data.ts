// YouTube competitor data — fetched on-demand via /api/scrape-youtube
// Static channel list; scraped results persisted in localStorage under "yt-scraped-data".

export interface YouTubeChannel {
  channelId: string;
  channelName: string;
}

export interface YouTubeVideo {
  channelId: string;
  channelName: string;
  title: string;
  url: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string; // ISO date string
  duration: number;    // seconds
  thumbnailUrl: string;
}

export interface YouTubeChannelSummary {
  channelId: string;
  channelName: string;
  videoCount: number;
  avgViews: number;
  avgLikes: number;
  avgComments: number;
  videos: YouTubeVideo[];
}

export const DEFAULT_YT_CHANNELS: YouTubeChannel[] = [
  { channelId: "UCbo-KbSjJDG6JWQ_MTZ_rNA", channelName: "Nick Saraev" },
  { channelId: "UCwAnu01qlnVg1Ai2AbtTMaA", channelName: "Jeff Su" },
  { channelId: "UC4FK5DEcMLB3CyJcbJfZEJA", channelName: "Nicholas Puru" },
  { channelId: "UCHkzp52CldSPZqU5T49mOnA", channelName: "Mark Kashef" },
  { channelId: "UC2ojq-nuP8ceeHqiroeKhBA", channelName: "Nate Herk" },
  { channelId: "UCOuGATIAbd2DvzJmUgXn2IQ", channelName: "NetworkChuck" },
];

export function buildYouTubeSummaries(videos: YouTubeVideo[]): YouTubeChannelSummary[] {
  const byChannel = new Map<string, YouTubeVideo[]>();

  for (const video of videos) {
    const key = video.channelId || video.channelName;
    const list = byChannel.get(key) ?? [];
    list.push(video);
    byChannel.set(key, list);
  }

  return Array.from(byChannel.entries()).map(([key, channelVideos]) => {
    const first = channelVideos[0];
    const avgViews = channelVideos.length > 0
      ? Math.round(channelVideos.reduce((s, v) => s + v.viewCount, 0) / channelVideos.length)
      : 0;
    const avgLikes = channelVideos.length > 0
      ? Math.round(channelVideos.reduce((s, v) => s + v.likeCount, 0) / channelVideos.length)
      : 0;
    const avgComments = channelVideos.length > 0
      ? Math.round(channelVideos.reduce((s, v) => s + v.commentCount, 0) / channelVideos.length)
      : 0;

    const sorted = [...channelVideos].sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    // Find matching default channel name by ID
    const defaultChannel = DEFAULT_YT_CHANNELS.find((c) => c.channelId === key || c.channelName === key);

    return {
      channelId: key,
      channelName: defaultChannel?.channelName ?? first?.channelName ?? key,
      videoCount: channelVideos.length,
      avgViews,
      avgLikes,
      avgComments,
      videos: sorted,
    };
  });
}
