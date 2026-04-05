import { NextResponse } from "next/server";

interface CaptionRequest {
  title: string;
  format: string;
  pillar?: string;
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured." },
      { status: 503 }
    );
  }

  let body: CaptionRequest;
  try {
    body = (await req.json()) as CaptionRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, format, pillar } = body;
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const systemPrompt = `You are a caption writer for an AI/automation Instagram creator (Lachy).
Based in Chiang Mai, Thailand. Builds real systems — VPS, Docker, n8n, Claude Code.
Style: calm authority, minimal, grounded. Not a hype influencer. INTJ energy.

Write captions that:
- Hook on line 1 (must stop scroll alone)
- No em-dash overload
- End with a soft CTA
- Include 10 relevant hashtags on the last line
- Under 2200 characters total`;

  const userPrompt = `Write an Instagram caption for this post:

Title: ${title}
Format: ${format}
${pillar ? `Content pillar: ${pillar}` : ""}

Return ONLY a JSON object with no markdown, no code fences:
{
  "caption": "the full caption text including hashtags on the last line",
  "hashtags": ["hashtag1", "hashtag2", ...]
}

The caption field should contain the complete caption — hook line, body (3-5 lines), CTA line, then hashtags on the final line.`;

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
        max_tokens: 1000,
        temperature: 0.8,
        system: systemPrompt,
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

    const data = await response.json() as {
      content: Array<{ type: string; text?: string }>;
    };

    const rawText = data.content.find((c) => c.type === "text")?.text ?? "";

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Could not parse JSON from Claude response", raw: rawText.slice(0, 500) },
        { status: 502 }
      );
    }

    const result = JSON.parse(jsonMatch[0]) as { caption: string; hashtags: string[] };
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: `Request failed: ${String(err)}` },
      { status: 500 }
    );
  }
}
