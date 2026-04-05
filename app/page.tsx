import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getRecentPosts, getCompetitors } from "@/lib/competitor-data";
import { Users, FileText, TrendingUp, PlusCircle, RefreshCw, CalendarDays } from "lucide-react";
import { ScheduledScrapeCard } from "@/components/scheduled-scrape-card";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const formatColors: Record<string, string> = {
  reel: "bg-primary/15 text-primary border-primary/20",
  album: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  post: "bg-zinc-700/40 text-zinc-400 border-zinc-600/30",
};

export default function HomePage() {
  const recentPosts = getRecentPosts(5);
  const competitors = getCompetitors();
  const totalPosts = competitors.reduce((s, c) => s + c.postCount, 0);
  const avgLikes = Math.round(
    competitors.reduce((s, c) => s + c.avgLikes, 0) / competitors.length
  );

  return (
    <div className="flex-1">
      <PageHeader
        title="Dashboard"
        description="Overview of your content intelligence"
      />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-primary/15 flex items-center justify-center">
                  <Users size={15} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Competitors</p>
                  <p className="text-xl font-semibold">{competitors.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-primary/15 flex items-center justify-center">
                  <FileText size={15} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Posts Tracked</p>
                  <p className="text-xl font-semibold">{totalPosts}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-primary/15 flex items-center justify-center">
                  <TrendingUp size={15} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Avg Likes</p>
                  <p className="text-xl font-semibold">{avgLikes.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Recent activity */}
          <div className="md:col-span-2">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Recent Competitor Posts</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {recentPosts.map((post, i) => (
                    <div key={i} className="px-5 py-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-medium text-primary">
                            @{post.username}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 h-4 ${formatColors[post.media_name]}`}
                          >
                            {post.media_name}
                          </Badge>
                        </div>
                        <p className="text-sm text-foreground/80 truncate">{post.hook}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">{formatDate(post.taken_at_date)}</p>
                        <p className="text-xs text-foreground mt-0.5">
                          {post.like_count.toLocaleString()} likes
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-3 border-t border-border">
                  <Link href="/competitors" className="text-xs text-primary hover:underline">
                    View all competitors →
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick actions */}
          <div>
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link
                  href="/instagram"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-secondary hover:bg-secondary/80 transition-colors"
                >
                  <PlusCircle size={15} className="text-primary shrink-0" />
                  <span className="text-sm">Add Post Idea</span>
                </Link>
                <Link
                  href="/competitors"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-secondary hover:bg-secondary/80 transition-colors"
                >
                  <RefreshCw size={15} className="text-primary shrink-0" />
                  <span className="text-sm">View Competitors</span>
                </Link>
                <Link
                  href="/calendar"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-secondary hover:bg-secondary/80 transition-colors"
                >
                  <CalendarDays size={15} className="text-primary shrink-0" />
                  <span className="text-sm">View Calendar</span>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
        <ScheduledScrapeCard />
      </div>
    </div>
  );
}
