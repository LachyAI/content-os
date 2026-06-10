import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { rootIdea, rootPlatform, rootFormat, existingIdeas } =
    (await req.json()) as {
      rootIdea: string;
      rootPlatform: string;
      rootFormat: string;
      existingIdeas?: Array<{ platform: string }>;
    };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  const allPlatforms = ["linkedin", "instagram", "youtube", "x-threads", "fb-groups", "blog"];
  const existingPlatforms = existingIdeas?.map((i) => i.platform) ?? [];
  const platforms = allPlatforms.filter((p) => !existingPlatforms.includes(p));

  if (platforms.length === 0) {
    return NextResponse.json({ ideas: [] });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `You are a content strategist. Given this core content idea, generate derivative content ideas for each platform listed.

Core idea: "${rootIdea}"
Original format: ${rootFormat} on ${rootPlatform}

Generate ONE idea for each of these platforms: ${platforms.join(", ")}

For each, provide:
- The platform name (exactly as given)
- A suggested format (e.g., "Text Post", "Carousel", "Reel / Short", "Thread", "Question", "Poll", "Story", "Newsletter", "Video Essay", "Long-form Article")
- A short idea/angle (1-2 sentences max — just the raw idea, NOT the actual content)

Respond in JSON array format:
[{"platform": "...", "format": "...", "angle": "..."}]

Only output the JSON array, nothing else.`,
          },
        ],
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

    const text = data.content?.find((c) => c.type === "text")?.text ?? "[]";

    try {
      const ideas = JSON.parse(text) as unknown[];
      return NextResponse.json({ ideas });
    } catch {
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        return NextResponse.json({ ideas: JSON.parse(match[0]) as unknown[] });
      }
      return NextResponse.json({ ideas: [] });
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Request failed: ${String(err)}` },
      { status: 500 }
    );
  }
}
