import { NextResponse } from "next/server";

interface RepurposeRequest {
  title: string;
  caption: string;
}

interface RepurposeResult {
  twitter: {
    tweet: string;
    thread: string[];
  };
  linkedin: string;
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured." },
      { status: 503 }
    );
  }

  let body: RepurposeRequest;
  try {
    body = (await req.json()) as RepurposeRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, caption } = body;
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const systemPrompt = `You are a content repurposer. Take Instagram content and adapt it for other platforms.
For X/Twitter: Concise, punchy, no hashtags in main tweet, thread format for longer content.
For LinkedIn: Professional tone, hook first line, more detail allowed, end with question or CTA.`;

  const userPrompt = `Repurpose this Instagram content for X/Twitter and LinkedIn.

Title: ${title}
Caption: ${caption || "(no caption provided)"}

Return ONLY a JSON object with no markdown, no code fences:
{
  "twitter": {
    "tweet": "a single punchy tweet under 280 chars — no hashtags",
    "thread": ["tweet 1 of thread", "tweet 2 of thread", "tweet 3 of thread", "tweet 4 (optional)", "tweet 5 (optional)"]
  },
  "linkedin": "full LinkedIn post — hook line, 3-5 lines of value, end with a question or CTA. 150-300 words."
}

Rules:
- twitter.tweet must be under 280 characters
- thread should be 3-5 tweets, each self-contained, numbered (1/ 2/ etc.)
- linkedin should be professional, not start with 'I', hook in first sentence`;

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
        max_tokens: 1500,
        temperature: 0.7,
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

    const result = JSON.parse(jsonMatch[0]) as RepurposeResult;
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: `Request failed: ${String(err)}` },
      { status: 500 }
    );
  }
}
