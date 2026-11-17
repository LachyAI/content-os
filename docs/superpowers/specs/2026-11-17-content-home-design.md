# Content OS: batch calendar, caption writer, saved links — short design

Date: 2026-11-17 · Owner: Lachy · Size: small change

## Intent
Lachy wants to use Content OS (content.opscorescale.com) more. After a scope cut the same day ("we don't have to
actually do that much... the only thing I really want is for all posts to show in calendar when batch is done...
and sometimes to create captions"), the build is four small pieces:

1. **Every queued post shows on the app's calendar when a batch is done.** This replaces the Excel tracker
   ("not excel that was planned").
2. **A caption writer:** type an idea, get a Facebook caption and a LinkedIn caption, each in its own format.
3. **Saved links on `/pinned`:** paste a good post's link (e.g. LinkedIn) with a note, kept for research.
4. **Phone install:** add the app to the iPhone home screen.

## Decided by Lachy (2026-11-17)
- **Approval stays as before**: GHL drafts, the local `preview.html`, his typed approve in a session. No Approve
  buttons in the app ("keep as before. Dont need to add more stuff to it").
- **Notion week page keeps the status list** (✅ ❗ ❌ with NEED FROM YOU) and gets the calendar link; caption
  material comes off the Notion page ("correct - notion is great").
- **All brands on the calendar**, Batch 2's ClearScale posts included ("correct").
- **Facebook: he schedules all posts by hand on batch day** ("we are not doing it this way anymore"). No app
  ticks, no WhatsApp drop changes. The Pinboard Facebook sheet stays.

## Approaches
- **Picked: sync at batch end.** A script reuses `scripts/content-tracker.sh`'s gather step (GHL `dump` plus the VPS
  `posts.json`) and upserts one read-only card per post into Supabase; the calendar reads them. Simple, no new
  infrastructure, matches "when batch is done".
- Rejected: the app calls GHL live. Needs GHL's key on Vercel, and Facebook posts aren't in GHL anyway.
- Rejected: full content home with Approve and Scheduled buttons (the first version of this design). Lachy cut it.

## Design
**Calendar.** `scripts/content-os-sync.mjs` (in `C:\Dev`) writes one card per queued post from today on, keyed by GHL
post id or, for Facebook rows, a hash of date + label + text, so re-running updates instead of duplicating. Card:
date, Chiang Mai time, brand, platform, how it posts, photo URL, full caption. Posts gone from the source are removed.
Facebook photos get a public URL (CDN `cdn.opscorescale.com/social/<run>/`) so the app can show them. `/calendar` shows
these cards in the month view and a "next 14 days" list for the phone; tapping one shows the photo, caption and a
Copy button. Finding: `/calendar` reads LinkedIn and Facebook from old browser storage today, so nothing the batch
writes reaches it; the synced cards fix that for queued posts.

**Caption writer.** A Write page: idea in (dictation-friendly), Facebook and LinkedIn captions out, Copy and
Regenerate on each. Rules, kept in one prompt file in the app with a pointer from `content-creation.md`:
Facebook = `content-creation.md` §Facebook personal caption format; LinkedIn = the `linkedin-caption-writer` format;
both = no invented proof, no other person's name or business, plain English, no dashes. Latest Claude model
(check the `claude-api` skill). `ANTHROPIC_API_KEY` is already on Vercel. The old `/api/caption` stays untouched.

**Saved links.** On `/pinned`, a box to paste a link plus an optional note. The platform is read from the URL.
Saved to Supabase so a link saved on the phone shows on the laptop. Each saved link shows the link, note, platform,
date, and delete. The existing competitor pins (browser-only) stay as they are. On iPhone it's copy the link, open
the app, paste: iOS doesn't let a home screen web app appear in the Share menu.

**Phone and desktop install** (desktop added by Lachy the same day: "also desktop app"). Web app manifest and icons,
opens full screen / in its own window. iPhone: Safari "Add to Home Screen". Laptop: Brave's "Install Content OS",
which gives it its own window and a taskbar icon. The PIN is asked once inside each installed app. Calendar, Write and
Pinned checked at 390px wide.

**Skill change.** `content-batch` SKILL.md step 5 runs the sync and gives the calendar link instead of the xlsx and
Drive upload; step 4 drops caption material from Notion and adds the calendar link. `content-tracker.sh` is no longer
called (left in place).

## Non-goals
Approving, scheduling or posting from the app · Facebook ticks or drop changes · touching the competitor, scrape,
hooks, news or analytics pages · changing the old `/api/caption`.

## Constraints
Build freeze: passive (`Score 1.5 · ROI 4 · Conf 5 · Diff 2 · Time 1 · Upkeep 1` · passive ✓). Deploy needs his OK.
Next.js 16: read `node_modules/next/dist/docs/` before writing code. Supabase keys via the `.env.prod` loader in
`scripts/content-os-board.mjs`, never printed. Commit explicit paths only.

## Left to the builder
Storage layout for synced cards and saved links (`board_cards` boards or a new table, RLS on any new table) · calendar
styling · a simple guard so strangers can't spend the Anthropic key through the Write route.

## Done means
- After the next batch, the calendar shows every queued post from today on, its count matching GHL `list` plus the
  Facebook rows, each with photo and caption.
- One real idea through the Write page gives both captions in their formats.
- A LinkedIn link saved on the phone shows on the laptop.
- The app is on his home screen and opens full screen.
