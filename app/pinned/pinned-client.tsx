'use client'

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { usePinnedPosts } from "@/lib/use-pinned-posts";
import { Bookmark, ExternalLink } from "lucide-react";

const formatColors: Record<string, string> = {
  reel: "bg-primary/15 text-primary border-primary/20",
  album: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  post: "bg-zinc-700/40 text-zinc-400 border-zinc-600/30",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export function PinnedClient() {
  const { pinned, unpin, mounted } = usePinnedPosts();

  if (!mounted) return null;

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold">Pinned Posts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pinned.length === 0
              ? "No pinned posts yet"
              : `${pinned.length} post${pinned.length !== 1 ? "s" : ""} saved`}
          </p>
        </div>
      </div>

      {pinned.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <Bookmark size={32} className="text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Pin posts from the Competitors page to save them here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[...pinned].reverse().map((post) => (
            <Card key={post.link_user} className="bg-card border-border">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-primary">@{post.username}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {formatDate(post.taken_at_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 h-4 ${formatColors[post.media_name]}`}
                    >
                      {post.media_name}
                    </Badge>
                    <a
                      href={post.link_user}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ExternalLink size={13} />
                    </a>
                    <button
                      onClick={() => unpin(post)}
                      title="Unpin post"
                      className="text-primary hover:text-primary/70 transition-colors"
                    >
                      <Bookmark size={13} fill="currentColor" />
                    </button>
                  </div>
                </div>

                <p className="text-sm text-foreground/80 line-clamp-3 mb-3">{post.hook}</p>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>
                    <span className="font-medium text-foreground">{post.like_count.toLocaleString()}</span> likes
                  </span>
                  <span>
                    <span className="font-medium text-foreground">{post.comment_count}</span> comments
                  </span>
                  <span className={cn(
                    "ml-auto font-medium",
                    (post.like_count + post.comment_count) > 1000 ? "text-primary" : ""
                  )}>
                    {(post.like_count + post.comment_count).toLocaleString()} eng.
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
