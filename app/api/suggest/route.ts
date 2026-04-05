import { NextResponse } from "next/server";

interface CompetitorPost {
  username: string;
  text: string;
  like_count: number;
  comment_count: number;
}

interface SuggestRequest {
  competitorPosts: CompetitorPost[];
  pillar?: string;
  previousTitles?: string[];
}

interface VideoIdea {
  title: string;
  hook: string;
  scriptOutline: string;
  pillar: string;
  reasoning: string;
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured. Add it to your environment variables." },
      { status: 503 }
    );
  }

  let body: SuggestRequest;
  try {
    body = (await req.json()) as SuggestRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { competitorPosts, pillar, previousTitles } = body;

  // Take top 50 by engagement, then randomly sample 30 for variety
  const sorted = [...(competitorPosts ?? [])]
    .sort((a, b) => (b.like_count + b.comment_count) - (a.like_count + a.comment_count))
    .slice(0, 50);
  // Shuffle and pick 30
  for (let i = sorted.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
  }
  const topPosts = sorted.slice(0, 30);

  if (topPosts.length === 0) {
    return NextResponse.json({ error: "No competitor posts provided" }, { status: 400 });
  }

  const postsContext = topPosts
    .map((p, i) =>
      `${i + 1}. @${p.username} | ${(p.like_count + p.comment_count).toLocaleString()} engagement\n   "${p.text.slice(0, 200)}${p.text.length > 200 ? "..." : ""}"`
    )
    .join("\n\n");

  const pillarFilter = pillar ? ` Focus specifically on the "${pillar}" content pillar.` : "";
  const avoidRepeat = previousTitles?.length
    ? `\n\nIMPORTANT: Do NOT suggest ideas similar to these previously generated ones:\n${previousTitles.map(t => `- ${t}`).join("\n")}\nGenerate completely DIFFERENT ideas with new angles and topics.`
    : "";

  const userPrompt = `Here are the top 30 competitor posts by engagement:

${postsContext}

Based on these competitor posts, generate 5 specific Instagram reel ideas for me.${pillarFilter}${avoidRepeat}

Seed for randomness: ${Date.now()}-${Math.random().toString(36).slice(2)}. Use this to ensure variety — pick different competitor posts to draw inspiration from each time.

Return ONLY a JSON array with no markdown, no code fences. Each item must have these exact keys:
- title: string (video title)
- hook: string (first 2-3 seconds of the video, what you say)
- scriptOutline: string (brief script outline under 30 seconds)
- pillar: string (one of: "Authority", "Discipline & Lifestyle", "Social & Magnetism")
- reasoning: string (why this would work based on the competitor data)

Example format: [{"title":"...","hook":"...","scriptOutline":"...","pillar":"...","reasoning":"..."}]`;

  const systemPrompt = `You are a content strategist for an AI/automation Instagram creator.
The creator (Lachy) is based in Chiang Mai, Thailand. He builds real production systems — VPS automation, Docker, n8n workflows, Claude Code, cron jobs. His angle is showing the BACKEND of AI, not just surface-level demos.

Content pillars:
1. Authority (3x/week): AI demos, automations, behind-the-scenes of real systems
2. Discipline & Lifestyle (2x/week): Gym, deep work, Chiang Mai cafe life
3. Social & Magnetism (1x/week): Quiet confidence, clean aesthetic

Style: Calm authority, minimal, grounded. Not a hype influencer. INTJ energy.

Generate video ideas that are specific, filmable, and differentiated from what competitors are doing. Ideas must be rooted in what the competitor data shows is performing.`;

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
        max_tokens: 2000,
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

    // Extract JSON array from the response (handle any stray markdown)
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Could not parse JSON from Claude response", raw: rawText.slice(0, 500) },
        { status: 502 }
      );
    }

    const ideas = JSON.parse(jsonMatch[0]) as VideoIdea[];
    return NextResponse.json({ ideas });
  } catch (err) {
    return NextResponse.json(
      { error: `Request failed: ${String(err)}` },
      { status: 500 }
    );
  }
}
