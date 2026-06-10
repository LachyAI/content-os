import { competitorData } from "./competitor-raw-data";

export interface RawPost {
  link_user: string;
  text: string;
  like_count: number;
  comment_count: number;
  media_name: "reel" | "album" | "post";
  taken_at_date: string;
  shortCode?: string;
}

export interface Post extends RawPost {
  username: string;
  hook: string;
  postUrl?: string;
}

export interface CompetitorSummary {
  username: string;
  postCount: number;
  avgLikes: number;
  avgComments: number;
  topFormat: "reel" | "album" | "post";
  posts: Post[];
}

function extractUsername(linkUser: string): string {
  const match = linkUser.match(/instagram\.com\/([^/?]+)/);
  return match ? match[1] : linkUser;
}

function extractHook(text: string): string {
  const firstLine = text.split("\n")[0].trim();
  return firstLine.length > 80 ? firstLine.slice(0, 80) + "..." : firstLine;
}

const posts: Post[] = (competitorData as unknown as RawPost[]).map((item) => ({
  ...item,
  username: extractUsername(item.link_user),
  hook: extractHook(item.text),
  postUrl: item.shortCode ? `https://www.instagram.com/p/${item.shortCode}/` : undefined,
}));

export function getAllPosts(): Post[] {
  return posts;
}

export function getCompetitors(): CompetitorSummary[] {
  const byUser = new Map<string, Post[]>();
  for (const post of posts) {
    const list = byUser.get(post.username) ?? [];
    list.push(post);
    byUser.set(post.username, list);
  }

  return Array.from(byUser.entries()).map(([username, userPosts]) => {
    const avgLikes = Math.round(
      userPosts.reduce((s, p) => s + p.like_count, 0) / userPosts.length
    );
    const avgComments = Math.round(
      userPosts.reduce((s, p) => s + p.comment_count, 0) / userPosts.length
    );

    const formatCounts = { reel: 0, album: 0, post: 0 };
    for (const p of userPosts) formatCounts[p.media_name]++;
    const topFormat = (
      Object.entries(formatCounts) as [Post["media_name"], number][]
    ).sort((a, b) => b[1] - a[1])[0][0];

    const sortedPosts = [...userPosts].sort(
      (a, b) =>
        new Date(b.taken_at_date).getTime() -
        new Date(a.taken_at_date).getTime()
    );

    return { username, postCount: userPosts.length, avgLikes, avgComments, topFormat, posts: sortedPosts };
  });
}

export function getRecentPosts(limit = 5): Post[] {
  return [...posts]
    .sort(
      (a, b) =>
        new Date(b.taken_at_date).getTime() - new Date(a.taken_at_date).getTime()
    )
    .slice(0, limit);
}
