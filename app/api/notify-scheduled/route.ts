import { NextResponse } from "next/server";

const BOARD_LABELS: Record<string, string> = {
  "fb-personal": "FB Personal",
  "fb-biz": "FB Business",
  "fb-groups": "FB Groups",
  linkedin: "LinkedIn",
  "x-threads": "X / Threads",
  instagram: "Instagram",
  calendar: "Calendar",
};

interface NotifyBody {
  board?: string;
  title?: string;
  date?: string;
}

export async function POST(req: Request) {
  const webhook = process.env.SLACK_WEBHOOK_URL;

  let body: NotifyBody;
  try {
    body = (await req.json()) as NotifyBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const board = (body.board ?? "").trim();
  const title = (body.title ?? "").trim();
  const date = (body.date ?? "").trim();

  if (!date) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  if (!webhook) {
    console.warn("[notify-scheduled] SLACK_WEBHOOK_URL not set — skipping");
    return NextResponse.json({ skipped: true });
  }

  const label = BOARD_LABELS[board] ?? board ?? "Content";
  const preview =
    title.length > 140 ? title.slice(0, 140) + "…" : title || "(untitled)";

  // Format YYYY-MM-DD nicely; fall back to the raw string otherwise.
  let whenText = date;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    whenText = d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  const text = `📅 *Post scheduled — ${label}*\n>${preview.replace(/\n/g, " ")}\n*When:* ${whenText}`;

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `Slack webhook error (${res.status}): ${errText.slice(0, 200)}` },
        { status: 502 }
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Request failed: ${String(err)}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
