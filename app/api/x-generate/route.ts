import { NextResponse } from "next/server";

const ALL_FORMATS = [
  "Bullet Insight",
  "Contrast / Reframe",
  "Single Principle",
  "Dense Paragraph",
  "Dialogue",
  "Escalating Lines",
  "Soft CTA",
];

function pickRandom3(): string[] {
  const shuffled = [...ALL_FORMATS];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, 3);
}

const SYSTEM_PROMPT = `You are a ghostwriter for Lachy — an AI/automation creator on X and Threads.
His voice: calm authority, INTJ, builder. Shows backend systems (n8n, Docker, Claude Code, VPS). Not a hype account.

VOICE RULES:
- Under 280 chars per post (strict limit)
- No hashtags. No emojis (max 1 if it genuinely adds punch)
- No fluff openers: never start with "Did you know", "Here's the truth", "Hot take:", "Most people don't realize"
- Insight-first: every post delivers one usable idea
- Personal voice — this is Lachy's account, not a brand

THE 7 FORMATS:

1. Bullet Insight
Bold opening claim → 3-4 bullet points → kicker line.
Example structure:
[Bold claim.]
• [Point 1]
• [Point 2]
• [Point 3]
[Kicker that lands the idea.]

2. Contrast / Reframe
State the wrong belief → the actual answer with 2-3 bullets.
[Common wrong belief.]
[The actual answer]:
• [Truth 1]
• [Truth 2]
• [Truth 3]
[One line that seals it.]

3. Single Principle
One idea. Three lines max. Reads like a maxim.
[Concept stated plainly.]
[Why it matters.]
[What changes when you apply it.]

4. Dense Paragraph
No line breaks. One continuous idea that builds and lands. Under 260 chars strictly.
[Claim.] [Why people get it wrong.] [What to do instead.] [Payoff.]

5. Dialogue
Two voices showing the gap between common thinking and the insight.
Most people: "[common belief]"
Reality: "[the actual answer]"

6. Escalating Lines
Each line noticeably longer than the last. Builds momentum.
[Shortest — the seed]
[Slightly longer — develops it]
[Longer again — adds depth]
[Longer again — builds tension]
[Longest line — the payoff]

7. Soft CTA
Teases value, ends with low-pressure call to action.
[What the resource/idea covers.]
[Why it matters.]
→ [CTA]`;

interface XGenerateRequest {
  idea: string;
  formats?: string[];
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured. Add it to your environment variables." },
      { status: 503 }
    );
  }

  let body: XGenerateRequest;
  try {
    body = (await req.json()) as XGenerateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { idea, formats } = body;
  if (!idea?.trim()) {
    return NextResponse.json({ error: "Idea is required" }, { status: 400 });
  }

  const selectedFormats = formats && formats.length > 0 ? formats : pickRandom3();

  const userPrompt = `RAW IDEA:
${idea}

Generate one X/Threads post for each of these formats: ${selectedFormats.join(", ")}.

Each post must be under 280 characters. Dense Paragraph must be under 260 characters.

Return ONLY a JSON array with no markdown, no code fences, no explanation. Each item must have:
- format: string (exactly matching the format name above)
- post: string (the post text, ready to copy-paste)

Example: [{"format":"Single Principle","post":"..."},{"format":"Dense Paragraph","post":"..."},{"format":"Dialogue","post":"..."}]`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        temperature: 0.9,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `Anthropic API error (${response.status}): ${errText.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text?: string }>;
    };

    const rawText = data.content.find((c) => c.type === "text")?.text ?? "";
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Could not parse JSON from response", raw: rawText.slice(0, 500) },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{ format: string; post: string }>;
    const results = parsed.map((r) => ({
      format: r.format,
      post: r.post,
      charCount: r.post.length,
    }));

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: `Request failed: ${String(err)}` },
      { status: 500 }
    );
  }
}
