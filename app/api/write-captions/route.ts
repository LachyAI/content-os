import { NextResponse } from "next/server";
import { buildSystemPrompt, CAPTIONS_SCHEMA, IDEA_MAX_CHARS } from "@/lib/caption-rules";

// Only the live site and a local dev server may call this, so a stranger can't spend the Claude credit.
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (origin === "https://content.opscorescale.com") return true;
  return /^http:\/\/localhost(:\d+)?$/.test(origin);
}

interface ApiContentBlock {
  type: string;
  text?: string;
}

interface ApiResponse {
  content?: ApiContentBlock[];
  stop_reason?: string;
}

export async function POST(req: Request) {
  if (!isAllowedOrigin(req.headers.get("origin"))) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  let idea = "";
  try {
    const body = (await req.json()) as { idea?: unknown };
    idea = typeof body.idea === "string" ? body.idea.trim() : "";
  } catch {
    return NextResponse.json({ error: "Send the idea as JSON" }, { status: 400 });
  }
  if (!idea) {
    return NextResponse.json({ error: "Type an idea first" }, { status: 400 });
  }
  if (idea.length > IDEA_MAX_CHARS) {
    return NextResponse.json({ error: `Keep the idea under ${IDEA_MAX_CHARS} characters` }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "The Claude key isn't set on the server" }, { status: 502 });
  }

  let data: ApiResponse;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2026-10-21",
        // Server-side fallback: if Opus declines, the API reruns the same request on a fallback model.
        "anthropic-beta": "server-side-fallback-2026-07-01",
      },
      body: JSON.stringify({
        model: "claude-opus-5-5",
        max_tokens: 8000,
        fallbacks: "default",
        system: buildSystemPrompt(),
        messages: [{ role: "user", content: `<idea>\n${idea}\n</idea>` }],
        output_config: {
          effort: "medium",
          format: { type: "json_schema", schema: CAPTIONS_SCHEMA },
        },
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      console.error(`write-captions: Claude API ${res.status}: ${detail}`);
      return NextResponse.json({ error: "Claude didn't answer. Try again in a minute." }, { status: 502 });
    }
    data = (await res.json()) as ApiResponse;
  } catch (err) {
    console.error("write-captions: request failed", err);
    return NextResponse.json({ error: "Claude didn't answer. Try again in a minute." }, { status: 502 });
  }

  if (data.stop_reason === "refusal") {
    return NextResponse.json({ error: "Claude declined this one. Try rewording the idea." }, { status: 502 });
  }

  const text = data.content?.find((b) => b.type === "text")?.text ?? "";
  try {
    const parsed = JSON.parse(text) as { facebook?: unknown; linkedin?: unknown };
    if (typeof parsed.facebook !== "string" || typeof parsed.linkedin !== "string") throw new Error("missing keys");
    return NextResponse.json({ facebook: parsed.facebook.trim(), linkedin: parsed.linkedin.trim() });
  } catch {
    console.error(`write-captions: unreadable reply (stop_reason ${data.stop_reason})`);
    return NextResponse.json({ error: "Claude's reply came back unreadable. Try again." }, { status: 502 });
  }
}
