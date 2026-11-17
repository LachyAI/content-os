# Content OS: batch calendar, Write page, saved links, install — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every queued post shows on the Content OS calendar after a batch, plus a caption Write page, saved research links on `/pinned`, and phone and desktop install.

**Architecture:** A Node script in `C:\Dev\scripts` gathers GHL posts and the VPS Facebook queue and upserts read-only cards into Supabase `board_cards` (board `queue`); the calendar reads them. Saved links use the existing `useSupabaseBoard` hook (board `saved-links`). The Write page calls a new API route that asks Claude for both captions. Install comes from a web app manifest and generated icons.

**Tech Stack:** Next.js 16 (App Router, read `node_modules/next/dist/docs/` first), Supabase REST + supabase-js, Node 25 (`node --test`, native TS type stripping), Anthropic Messages API, Playwright for screenshots.

**Spec:** `docs/superpowers/specs/2026-11-17-content-home-design.md`

## Global Constraints
- Supabase keys: load from `C:/Dev/projects/active/content-os/.env.prod` with the loader in `C:\Dev\scripts\content-os-board.mjs`; never print them.
- Time zone for every date and time shown: Chiang Mai, UTC+7.
- Nothing in this build approves, schedules or posts anything. Old `/api/caption` stays untouched.
- No new npm dependencies.
- Commit explicit paths only; `git status` before every commit (other sessions work in `C:\Dev`). Content OS repo commits go to `main`.
- Deploy only after Lachy's OK: `npx vercel deploy --prod --yes` from the project dir, then fetch the live URL.
- User-facing copy: plain English, no dashes.

## Review Focus
1. **GHL dump fails or returns nothing** → the sync must stop before deleting anything; the calendar keeps its last cards. (Task 1 test `refuses to prune on empty input`.)
2. **Running the sync twice** → same card count, no duplicates. (Task 1 test `ids are deterministic`.)
3. **A Facebook row with no photo, or several** → card shows no image / the first image, no crash. (Task 1 test `fb row media variants`.)
4. **An unknown GHL account** (new page connected later) → card still shows, brand `?`, platform from the raw platform name. (Task 1 test `unknown account`.)
5. **A pasted link with tracking junk or no `https://`** → saved with the platform detected; a non-URL is rejected with a message. (Task 4 test `detectPlatform` cases.)

---

### Task 1: Queue card mapping (pure, tested)

**Files:**
- Create: `C:\Dev\scripts\content-os-queue.mjs`
- Test: `C:\Dev\scripts\content-os-queue.test.mjs`

**Interfaces:**
- Produces:
  - `uuidFromKey(key: string): string` — sha1 of key formatted as a v5-shaped UUID.
  - `ghlToCards(posts: GhlPost[], from: string, to: string): QueueCard[]` — `GhlPost` is one item of `ghl-social-post.mjs dump` output: `{id, status, scheduleDate, accounts:[{platform,name}], text, comment, media:string[]}`.
  - `fbToCards(rows: FbRow[], from: string, to: string, mediaBase: string): QueueCard[]` — `FbRow` = `{date, label?, text?, media?: string|string[], how?, auto?, scheduled?}`; skips `auto` rows.
  - `QueueCard` (stored as `board_cards.data`): `{id, text, status:"queued", createdAt, source:"ghl"|"fb", sourceStatus, date:"YYYY-MM-DD", time:string|null, at:string, brand, platform, how, image:string|null, extraImages:number, label:string|null}`.
  - Brand map (port of `scripts/build-content-tracker.py` BRAND plus fallbacks): name contains `ClearScale`/`clearscaleau` → ClearScale; `ACoS` → ACoS IQ; `Lachlan Coleman-Barrett`, `lachlancbd`, `lachlan.ai` → LachlanCB; else `?`. Platform: facebook → `Facebook page`, linkedin + `Lachlan Coleman-Barrett` → `LinkedIn`, other linkedin → `LinkedIn page`, instagram → `Instagram`, threads → `Threads`, google → `Google Business Profile`, else the raw platform. Multi-account posts join with ` + `.
  - GHL `how` = `Posts itself (GHL)`; text appends `\n\n[first comment] <comment>` when present. FB: brand `LachlanCB`, platform `Facebook (personal)`, time `null`, `how` = `Scheduled in Facebook by you` if `scheduled` else `You schedule it in Facebook`, id = `uuidFromKey("fb|"+date+"|"+(label??"")+"|"+(text??""))`, image = `mediaBase + encodeURIComponent(firstMedia)`.

- [ ] **Step 1: Write the failing tests** with `node:test` + `node:assert/strict`:
  - `ids are deterministic`: same GHL post twice → same `id`; id matches `/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/`.
  - `ghl mapping`: post `scheduleDate "2026-11-18T11:00:00Z"`, accounts `[{platform:"instagram",name:"lachlancbd"}]` → `date "2026-11-18"`, `time "6:00pm"`, brand `LachlanCB`, platform `Instagram`, image = first media URL, `extraImages` = media.length − 1.
  - `window filter`: a post on `2026-11-17T16:59:00Z` (23:59 CM on the 17th) is excluded when `from = "2026-11-18"`.
  - `unknown account`: `{platform:"tiktok",name:"x"}` → brand `?`, platform `tiktok`.
  - `fb row media variants`: no media → `image null, extraImages 0`; `["a b.jpg","c.jpg"]` → image ends `a%20b.jpg`, `extraImages 1`; `auto:true` row → skipped.
  - `refuses to prune on empty input` is tested in Task 2 via `planSync`; here, `ghlToCards([])` returns `[]`.
- [ ] **Step 2:** Run `node --test scripts/content-os-queue.test.mjs` from `C:\Dev`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement the module per the Interfaces block.
- [ ] **Step 4:** Run the same command. Expected: all PASS.
- [ ] **Step 5:** Commit in `C:\Dev`: `git add scripts/content-os-queue.mjs scripts/content-os-queue.test.mjs && git commit -m "feat(content-os): Map GHL and Facebook queue posts to calendar cards"`.

### Task 2: Sync script

**Files:**
- Create: `C:\Dev\scripts\content-os-sync.mjs`
- Modify: `C:\Dev\scripts\content-os-queue.mjs` (add `planSync`), its test file

**Interfaces:**
- Consumes: Task 1 exports.
- Produces: CLI `node scripts/content-os-sync.mjs [--from YYYY-MM-DD] [--days 90] [--dry]`; prints `synced N cards (GHL a, Facebook b), removed c` and `https://content.opscorescale.com/calendar`. Pure helper `planSync(newCards: QueueCard[], existingIds: string[]): {upsert: QueueCard[], remove: string[]}` throws `"no posts gathered, refusing to prune"` when `newCards` is empty and `existingIds` is not.

- [ ] **Step 1: Failing tests** for `planSync`: removes ids not in the new set; keeps the rest; throws the exact message on empty input with existing ids; empty + empty → `{upsert:[],remove:[]}`.
- [ ] **Step 2:** `node --test scripts/content-os-queue.test.mjs` → FAIL.
- [ ] **Step 3:** Implement `planSync`, then the CLI: GHL via `node scripts/ghl-social-post.mjs dump <from-1 day>T17:00:00Z <to>T17:00:00Z` (as `content-tracker.sh`); Facebook via one ssh (`~/.ssh/do_key`, `root@139.59.231.172`) that runs `mkdir -p /var/www/static/assets/social/fb-queue && cp -n /root/automation/fb-post-drop/media/* /var/www/static/assets/social/fb-queue/ ; cat /root/automation/fb-post-drop/posts.json`; `mediaBase = "https://cdn.opscorescale.com/social/fb-queue/"`. Read existing ids with `GET /rest/v1/board_cards?select=id&board=eq.queue`, upsert with `POST` + `Prefer: resolution=merge-duplicates,return=minimal` rows `{id, board:"queue", data}`, delete with `DELETE /rest/v1/board_cards?board=eq.queue&id=in.(...)`. Any failed fetch or ssh exits non-zero before writing.
- [ ] **Step 4:** Tests PASS, then `node scripts/content-os-sync.mjs --dry` prints the counts without writing; then a real run; run it again and confirm the count line is identical and `removed 0`.
- [ ] **Step 5:** Open one Facebook image URL from the output with `curl -s -o /dev/null -w "%{http_code}"` → `200`.
- [ ] **Step 6:** Commit `scripts/content-os-sync.mjs scripts/content-os-queue.mjs scripts/content-os-queue.test.mjs`.

### Task 3: Calendar shows queue cards

**Files:**
- Create: `lib/use-queue-posts.ts`, `components/queue-post-dialog.tsx`, `app/calendar/queue-list.tsx`
- Modify: `app/calendar/calendar-client.tsx` (merge queue posts into `postsByDate`, open the dialog on tap), `app/calendar/page.tsx` (render `QueueList` above the month grid)

**Interfaces:**
- Consumes: board `queue` rows (`QueueCard` shape from Task 1).
- Produces: `useQueuePosts(): {posts: QueueCard[], mounted: boolean}` (read-only, ordered by `at`); `<QueuePostDialog post open onOpenChange />` shows photo, brand, platform, date, time (or "you pick the time in Facebook"), how, full caption, a Copy button; `<QueueList days={14} />` lists the next 14 days grouped by day.

- [ ] **Step 1:** `npx tsc --noEmit` passes before changes (baseline).
- [ ] **Step 2:** Implement. Month grid: queue posts get a dot coloured by brand and count toward the day; the day dialog lists them with the existing ones. `QueueList` is the default view below 768px; on desktop it sits above the grid, collapsed to the next 7 days.
- [ ] **Step 3:** `npx tsc --noEmit` and `npm run lint` clean for touched files.
- [ ] **Step 4:** Start dev (`env -u NODE_OPTIONS node node_modules/next/dist/bin/next dev`), Playwright screenshot `/calendar` at 1280px and 390px: today's queued posts appear with thumbnails; tap one opens the dialog with the caption; Copy puts the caption on the clipboard.
- [ ] **Step 5:** Commit the five files.

### Task 4: Saved links on `/pinned`

**Files:**
- Create: `lib/link-platform.ts`, `lib/link-platform.test.ts`, `app/pinned/saved-links.tsx`
- Modify: `app/pinned/pinned-client.tsx` (render `<SavedLinks />` above the competitor pins)

**Interfaces:**
- Produces: `detectPlatform(input: string): {url: string, platform: "LinkedIn"|"Instagram"|"Facebook"|"X"|"Threads"|"TikTok"|"YouTube"|"Reddit"|"Other"} | null` — adds `https://` when missing, strips `utm_*` and LinkedIn `trk`/`rcm` query params, returns `null` for a non-URL. Card on board `saved-links`: `{id, text: note, status:"saved", createdAt, url, platform}` via `useSupabaseBoard("saved-links","link")`.

- [ ] **Step 1: Failing tests** (`node --test lib/link-platform.test.ts`): `https://www.linkedin.com/posts/abc?utm_source=share&rcm=x` → LinkedIn, query stripped; `linkedin.com/feed/update/urn:li:activity:1` → `https://` added; `x.com/a/status/1` and `twitter.com/...` → X; `threads.net/@a/post/1` and `threads.com/...` → Threads; `youtu.be/abc` → YouTube; `hello world` → `null`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement `detectPlatform` (relative imports only, no `@/` alias). **Step 4:** Run → PASS.
- [ ] **Step 5:** Build `SavedLinks`: link input + optional note + Save; invalid input shows "That doesn't look like a link"; list newest first with platform badge, note, date, open link, delete. Mobile-first layout.
- [ ] **Step 6:** Playwright: save a LinkedIn link at 390px, reload, it persists; delete it. tsc + lint clean.
- [ ] **Step 7:** Commit the four files.

### Task 5: Write page (Facebook + LinkedIn captions)

**Files:**
- Create: `lib/caption-rules.ts`, `app/api/write-captions/route.ts`, `app/write/page.tsx`, `app/write/write-client.tsx`
- Modify: `components/sidebar.tsx` (add "Write" second, after Home), `C:\Dev\knowledge\operational\content-creation.md` (one pointer line under §Facebook personal caption format: the app's copy of these rules is `projects/active/content-os/lib/caption-rules.ts`; change both together)

**Interfaces:**
- Produces: `POST /api/write-captions` body `{idea: string}` (1–4000 chars) → `{facebook: string, linkedin: string}`; 400 on bad input, 403 when `Origin` isn't `https://content.opscorescale.com` or `http://localhost:*`, 502 on API failure. `buildSystemPrompt(): string` in `lib/caption-rules.ts`.

- [ ] **Step 1:** Load the `claude-api` skill; pick the model id and request shape from it (latest Claude model; structured JSON output if supported, else a strict JSON instruction plus a parse guard).
- [ ] **Step 2:** Write `caption-rules.ts` from the vault sources, read this session: `content-creation.md` §Facebook personal caption format and the `linkedin-caption-writer` skill's format. Shared rules verbatim from the spec: no invented proof (only facts in the idea), no other person's name or business, plain English, no dashes.
- [ ] **Step 3:** Implement the route and page: textarea (dictation-friendly, autofocus), Write button, two result panels (stacked under 768px) each with Copy and Regenerate (regenerates both; one call).
- [ ] **Step 4:** Verify: `curl` the local route with `{"idea":""}` → 400; with an `Origin: https://evil.example` header → 403; one real idea via the page at 390px → Facebook caption has blank lines between paragraphs and no numbered list; LinkedIn caption has the numbered ↳ structure and ends with a question; neither contains a number absent from the idea.
- [ ] **Step 5:** Commit the five app files; commit `content-creation.md` in `C:\Dev` separately.

### Task 6: Phone and desktop install

**Files:**
- Create: `app/manifest.ts`, icon files per the Next 16 metadata docs (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/manifest.md` and the app-icons doc beside it)
- Modify: `app/layout.tsx` (`metadata.title` → `Content OS`, `appleWebApp: {capable: true, title: "Content OS", statusBarStyle: "black-translucent"}`, `viewport.themeColor "#111111"`)

**Interfaces:**
- Produces: `/manifest.webmanifest` with `name "Content OS"`, `short_name "Content OS"`, `start_url "/calendar"`, `display "standalone"`, `background_color` and `theme_color "#111111"`, icons 192 and 512 PNG (from `app/icon.svg`'s design: dark rounded square, orange C) and a 180 PNG apple icon.

- [ ] **Step 1:** Implement (generate PNG icons with `next/og` `ImageResponse` file conventions, no binary files committed unless the docs require it).
- [ ] **Step 2:** `npm run build` passes. On the dev server: manifest returns 200 with the fields above; each icon URL returns 200 `image/png`; Chrome DevTools MCP `Application` view (or `evaluate_script` fetching the manifest) shows no installability errors.
- [ ] **Step 3:** Commit.

### Task 7: Skill change, deploy, outcome check

**Files:**
- Modify: `C:\Users\Lochm\.claude\skills\content-batch\SKILL.md` steps 4 and 5 (load `writing-for-agents` first)
- Modify: `C:\Dev\knowledge\projects\content-os.md` (Planned → built, `actual Time N`)

- [ ] **Step 1:** SKILL.md step 5: run `node scripts/content-os-sync.mjs`, done when its count equals GHL `list` for the window plus the Facebook rows; give him the calendar link; the xlsx and Drive upload are gone (`content-tracker.sh` left in place, not called). Step 4: the week page keeps the status list (✅ ❗ ❌, NEED FROM YOU) and adds the calendar link; caption material no longer goes on Notion.
- [ ] **Step 2:** Ask Lachy to OK the deploy. On OK: `git status`, `npx vercel deploy --prod --yes`, then fetch `https://content.opscorescale.com/manifest.webmanifest` (200) and `/write` (200), and confirm the live calendar bundle contains the queue list.
- [ ] **Step 3:** Run the real sync against production; tell Lachy the three install steps (iPhone: Safari share → Add to Home Screen; laptop: Brave menu → Install Content OS; enter the PIN once in each).
- [ ] **Step 4:** Commit the vault and skill edits in `C:\Dev` (explicit paths). Diary line in `knowledge/diary/2026-11-17.md`.
