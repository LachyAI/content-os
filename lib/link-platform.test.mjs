// Run: node --test lib/link-platform.test.mjs  (Node 25 strips the types from link-platform.ts)
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectPlatform } from "./link-platform.ts";

test("LinkedIn share link loses its tracking params", () => {
  const r = detectPlatform("https://www.linkedin.com/posts/abc-123?utm_source=share&utm_medium=member_desktop&rcm=xyz");
  assert.equal(r.platform, "LinkedIn");
  assert.equal(r.url, "https://www.linkedin.com/posts/abc-123");
});

test("keeps params that are not tracking", () => {
  const r = detectPlatform("https://www.youtube.com/watch?v=abc&utm_source=x");
  assert.equal(r.platform, "YouTube");
  assert.equal(r.url, "https://www.youtube.com/watch?v=abc");
});

test("adds https when missing", () => {
  const r = detectPlatform("linkedin.com/feed/update/urn:li:activity:1");
  assert.equal(r.platform, "LinkedIn");
  assert.equal(r.url, "https://linkedin.com/feed/update/urn:li:activity:1");
});

test("platforms by host", () => {
  const cases = {
    "https://x.com/a/status/1": "X",
    "https://twitter.com/a/status/1": "X",
    "https://www.threads.net/@a/post/1": "Threads",
    "https://www.threads.com/@a/post/1": "Threads",
    "https://youtu.be/abc": "YouTube",
    "https://www.instagram.com/p/abc/": "Instagram",
    "https://www.facebook.com/share/p/abc/": "Facebook",
    "https://fb.watch/abc": "Facebook",
    "https://www.tiktok.com/@a/video/1": "TikTok",
    "https://www.reddit.com/r/a/comments/1/": "Reddit",
    "https://example.com/blog": "Other",
  };
  for (const [input, platform] of Object.entries(cases)) assert.equal(detectPlatform(input)?.platform, platform, input);
});

test("trims pasted whitespace", () => {
  assert.equal(detectPlatform("  https://x.com/a/status/1 \n")?.url, "https://x.com/a/status/1");
});

test("rejects text that is not a link", () => {
  assert.equal(detectPlatform("hello world"), null);
  assert.equal(detectPlatform(""), null);
  assert.equal(detectPlatform("notadomain"), null);
});
