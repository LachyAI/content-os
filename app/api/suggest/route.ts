import { NextResponse } from "next/server";

interface CompetitorPost {
  username: string;
  text: string;
  like_count: number;
  comment_count: number;
}

interface SuggestRequest {
  competitorPosts?: CompetitorPost[];
  pillar?: string;
  previousTitles?: string[];
  mode?: "suggest" | "script" | "generate";
  context?: string;
  platform?: string;
  format?: string;
  references?: string;
  hooks?: string;
  hookPatterns?: string[];
  bannedPhrases?: string[];
  scriptingKnowledge?: string;
  realScripts?: string;
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

  const { competitorPosts, pillar, previousTitles, mode, context, format, references, hooks, hookPatterns, bannedPhrases, scriptingKnowledge, realScripts } = body;

  // Generate mode — raw idea → title + caption + script
  if (mode === "generate" && context) {
    const formatLabel = format || "Reel";
    const generatePrompt = `You are a direct-response copywriter who writes Instagram ${formatLabel} scripts. You write for Lachy — calm authority, grounded, INTJ. Builds real automation systems (n8n, VPS, Claude Code, Docker, GHL). Shows the backend, not surface demos. Never hype, never cringe.

REFERENCE REELS (study structure and pacing, do not copy):
${references || "(none)"}

HOOK LIBRARY (proven hooks in this niche):
${hooks || "(none)"}

HOOK PATTERNS:
${(hookPatterns ?? []).map((p: string, i: number) => `${i + 1}. ${p}`).join("\n") || "(none)"}

BANNED PHRASES (never use or paraphrase):
${(bannedPhrases ?? []).map((p: string) => `- ${p}`).join("\n") || "(none)"}

${scriptingKnowledge ? `═══ SCRIPTING KNOWLEDGE BASE ═══\n${scriptingKnowledge}\n` : ""}
${realScripts ? `═══ REAL HIGH-PERFORMING REEL SCRIPTS (transcribed from top creators — study structure, pacing, hooks) ═══\n${realScripts}\n` : ""}
THE RAW IDEA (this is voice-to-text or rough notes — extract every concrete detail):
${context}

═══ COPYWRITING RULES ═══

1. STAY ON THE CREATOR'S TOPIC. Extract the real idea from their raw text. Do not substitute a different topic.
2. USE COPYWRITING FRAMEWORKS. Apply one or more: open loop, curiosity gap, problem-agitate-solve, before/after, specificity (numbers, names, tools), future pacing, pattern interrupt. The script must PERSUADE, not just inform.
3. EVERY POINT MUST BE CONCRETE. Name the tool, the database, the workflow, the file, the number. No generic advice. If the raw idea mentions something specific, use it.
4. WRITE FOR SPEAKING. These are talking points the creator riffs on while filming — conversational, not robotic. Each point should feel like something you'd actually say to a friend showing them your screen.
5. GENERATE 8-12 TALKING POINTS. Always aim for the higher end. Break complex steps into multiple points — one action per point. If a step involves multiple tools or screens, split it.
6. ORDER POINTS AS A NARRATIVE. Follow this arc: Context/Problem (why this matters) → Setup (what you built) → Inputs (where data comes from) → Process (what happens step by step) → Output (what you get) → Result (the specific outcome). Every point must logically follow the previous one.

═══ OUTPUT FORMAT ═══

Return ONLY valid JSON. No markdown, no code fences, no explanation outside the JSON.

{
  "title": "Short punchy title, under 60 chars. Works as text overlay.",
  "caption": "Instagram caption. Structure:\\n\\nLine 1: Hook — one sentence that creates tension or curiosity (not a restatement of the title).\\nLine 2-4: Body — 2-3 short paragraphs. Each one makes a specific claim about what the system does. Use concrete details from the raw idea. Create an open loop or build on the previous paragraph.\\nLast line: CTA — comment a specific UPPERCASE keyword for something valuable. Must feel earned by the caption above it.\\n\\nNo hashtags. No emojis. Calm, blunt, certain tone.",
  "script": "Filming script. Structure it EXACTLY like this:\\n\\nHOOK:\\nOne sentence, max 12 words. Must create curiosity or tension. Not a flex — a door the viewer wants to walk through.\\n\\nTALKING POINTS (8-12 points, ordered as a narrative: context → setup → inputs → process → output → result):\\n1. [What to say] — [What to show on screen]\\n   Detail: 2-3 sentences expanding this point. What exactly happens, what tool, what the viewer sees.\\n2. [What to say] — [What to show on screen]\\n   Detail: 2-3 sentences.\\n... continue for 8-12 points. One action per point. If a step involves multiple tools or screens, split into separate points.\\n\\nEach talking point should be detailed enough that the creator knows exactly what to say and what to show. Include the specific tools, screens, databases, workflows mentioned in the raw idea.\\n\\nPAYOFF:\\nOne sentence — the 'so what'. What does this achieve? Use a specific number or outcome from the raw idea.\\n\\nCTA:\\nOne sentence. Comment a keyword, save, or follow. Must connect to the payoff.\\n\\nFILMING NOTES:\\n- 3-5 specific shots (e.g. 'screen record: Notion database with entries visible', not just 'show Notion')"
}`;

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
          max_tokens: 4096,
          temperature: 0.8,
          messages: [{ role: "user", content: generatePrompt }],
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
          { error: "Could not parse JSON from response", raw: rawText.slice(0, 500) },
          { status: 502 }
        );
      }
      const parsed = JSON.parse(jsonMatch[0]) as { title: string; caption: string; script: string };
      return NextResponse.json({ title: parsed.title, caption: parsed.caption, script: parsed.script });
    } catch (err) {
      return NextResponse.json(
        { error: `Request failed: ${String(err)}` },
        { status: 500 }
      );
    }
  }

  // Script generation mode — uses the full prompt from the client directly
  if (mode === "script" && context) {
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
          max_tokens: 3000,
          temperature: 0.85,
          messages: [{ role: "user", content: context }],
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
      const script = data.content.find((c) => c.type === "text")?.text ?? "";
      return NextResponse.json({ script });
    } catch (err) {
      return NextResponse.json(
        { error: `Request failed: ${String(err)}` },
        { status: 500 }
      );
    }
  }

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
