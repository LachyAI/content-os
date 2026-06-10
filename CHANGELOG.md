# Content OS Changelog

## 2026-04-08 — Competitors page crash fix (Kru.bank / All Posts)

### Bug
- `/competitors` page rendered, but clicking "All Posts" tab or any scraped competitor
  with hidden engagement counts (e.g. `@Kru.bank` — banks hide likes on Instagram)
  threw the React error boundary: "This page couldn't load. Reload to try again..."
- Root cause: `rawToPost()` only spread `{...raw, username, hook}` and trusted Apify's
  field shape. Apify's `instagram-profile-posts-scraper-no-cookies` returns `null`/missing
  `like_count` for accounts that hide likes. Render layer called
  `post.like_count.toLocaleString()` on `undefined` → throw → unmount.
- "All Posts" inherited the same broken posts via `competitors.flatMap(c => c.posts)`,
  so it crashed too.

### Fix (`app/competitors/competitors-client.tsx`)
1. **`rawToPost()` normalization** — coerces every field with fallbacks for both
   static schema (`like_count`, `comment_count`, `media_name`, `taken_at_date`,
   `link_user`, `text`) and Apify schema (`likesCount`, `commentsCount`, `type`,
   `timestamp`, `ownerUsername`, `caption`). Forces numbers via `Number(...) || 0`.
   Maps `type: "Video"|"Sidecar"|"Image"` → `media_name: "reel"|"album"|"post"`.
2. **Mount-time self-heal** — `useEffect` walks existing localStorage scraped entries
   through `healPost()` and rewrites them. Already-broken Kru.bank data fixes itself
   on next page load — no manual `localStorage.clear()` required.
3. **Defensive render** — `(post.like_count ?? 0).toLocaleString()` and
   `(post.comment_count ?? 0)` at both render sites (AllPostsTable + selected
   competitor table) as belt-and-suspenders.

### Deployed
- Production: `dpl_BL3wjXFqT9LJg2K8hxH8K2bGJLRi`
- URL: https://content.opscorescale.com/competitors
- Build: clean (TS green, all 20 routes generated)
- Verified: clicking "All Posts" and Kru.bank both render correctly.

### Lesson
- Any time scraped data lands in localStorage, normalize at the boundary
  (`rawToPost`), not at the render site. Render code should never trust
  third-party API field shapes.
- When Apify actor results feed React tables, always coerce engagement counts
  to numbers — accounts can hide likes any time.

---

## 2026-04-06 — Scrape Fix, Script Generator, Hook Library

### Scrape System (Competitors)
- Fixed Apify timeout error — switched from server-side polling to async pattern
  - `/api/scrape` now returns `runId` immediately
  - New `/api/scrape/status?runId=xxx` endpoint — client polls every 5s
  - Live progress counter shown during scrape ("Scraping 8 competitors... 15s")
  - Max wait: 5 minutes (up from 110s hard crash)
- Add Competitor input now accepts Instagram URLs (`instagram.com/username`) — auto-extracts username
- Deduplication at save time — Apify duplicate posts filtered before storing to localStorage

### Script Generator (Instagram)
- Fixed `[Could not generate — check API]` error
  - `/api/suggest` now handles `mode: "script"` — passes prompt directly to Claude
  - Previously only worked with competitor post suggestions (required non-empty `competitorPosts`)
- Script generator now injects top 10 saved hooks (by engagement) from Hook Library into prompt
  - Hooks used as inspiration for tone/structure, not copied verbatim

### Hook Library (New Page)
- New `/hooks` page added to sidebar
- Auto-extracts first line from all scraped competitor posts as hooks
- Sorted by engagement (likes + comments), 20 per page with pagination
- Search by hook text
- Save/unsave to swipe file (bookmark icon)
- All/Saved tab toggle
- Deduplication by username + hook text
- Stable sort (no hooks jumping between pages)
