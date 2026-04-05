import { NextResponse } from "next/server";

interface HashtagRequest {
  pillar: string;
  currentHashtags?: string[];
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured." },
      { status: 503 }
    );
  }

  let body: HashtagRequest;
  try {
    body = (await req.json()) as HashtagRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { pillar, currentHashtags } = body;
  if (!pillar) {
    return NextResponse.json({ error: "pillar is required" }, { status: 400 });
  }

  const systemPrompt = `You are a hashtag strategist for an AI/automation Instagram creator (Lachy).
Based in Chiang Mai, Thailand. Builds real systems — VPS, Docker, n8n, Claude Code.
Content pillars: Authority (AI/automation), Discipline & Lifestyle (gym, digital nomad), Social & Magnetism (personal brand, quiet confidence).
Style: calm authority, minimal, grounded. INTJ energy.`;

  const currentCtx = currentHashtags?.length
    ? `\n\nCurrently using: ${currentHashtags.join(", ")}\n\nGenerate DIFFERENT hashtags — avoid any already in use.`
    : "";

  const userPrompt = `Generate 10 fresh Instagram hashtags for the "${pillar}" content pillar.${currentCtx}

Requirements:
- Mix of niche-specific (#AIautomation, #ClaudeCode) and broader reach (#DigitalNomad)
- Avoid oversaturated generic tags (#love, #instagood)
- Relevant to Lachy's audience: builders, solopreneurs, AI-curious professionals
- Include the # symbol

Return ONLY a JSON array of exactly 10 strings, no markdown, no code fences:
["#hashtag1", "#hashtag2", ...]`;

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
        max_tokens: 400,
        temperature: 0.9,
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

    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Could not parse JSON from Claude response", raw: rawText.slice(0, 500) },
        { status: 502 }
      );
    }

    const hashtags = JSON.parse(jsonMatch[0]) as string[];
    return NextResponse.json({ hashtags });
  } catch (err) {
    return NextResponse.json(
      { error: `Request failed: ${String(err)}` },
      { status: 500 }
    );
  }
}
