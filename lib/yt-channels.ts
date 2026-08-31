// Two YouTube channels, two brands, two vocabularies. Same operator.
//   @lachlanSEO  = ClearScale  -> AU local SEO for tradies. NEVER says "AI".
//   @Lachlan-AI  = LachlanCB   -> AI is the product.
// Source of truth for the split: knowledge/operational/youtube-channels.md

export type YTChannel = "seo" | "ai";

export interface YTChannelConfig {
  key: YTChannel;
  /** Nav + page label */
  label: string;
  /** Brand that owns the channel */
  brand: string;
  /** YouTube handle */
  handle: string;
  /** Public channel URL */
  url: string;
  /** Context passed to /api/suggest so generated ideas/scripts stay on-brand */
  aiContext: string;
  /** localStorage key for the video board */
  postsKey: string;
  /** localStorage key for saved scripts */
  scriptsKey: string;
  /** localStorage key for tag sets */
  tagsKey: string;
  /** Default tag pillars for a fresh channel */
  tagDefaults: Record<string, string[]>;
  /** Seed the board with sample cards on first load (AI channel only) */
  seedSamples: boolean;
}

export const YT_CHANNELS: Record<YTChannel, YTChannelConfig> = {
  // ClearScale — @lachlanSEO. AU tradies buy outcomes, not tools. No "AI" language.
  seo: {
    key: "seo",
    label: "YouTube SEO",
    brand: "ClearScale",
    handle: "@lachlanSEO",
    url: "https://www.youtube.com/@lachlanSEO",
    aiContext:
      "YouTube channel about local SEO, Google Business Profile, Google Maps ranking, and lead generation for Australian trade businesses — electricians, solar installers, plumbers. Audience: Australian trade business owners with 5+ staff. They buy outcomes: more leads, more jobs, ranking on Google. HARD RULE: never use the word 'AI' or AI-tool language anywhere — that register repels this audience. Creator: Lachy.",
    postsKey: "content-os-youtube-posts-seo",
    scriptsKey: "content-os-yt-scripts-seo",
    tagsKey: "content-os-youtube-tags-seo",
    seedSamples: false,
    tagDefaults: {
      "Local SEO": [
        "local seo", "google business profile", "google maps ranking", "seo for tradies",
        "local search", "gbp optimisation", "google my business", "rank on google",
        "seo for contractors", "local seo australia",
      ],
      "Lead Generation": [
        "lead generation", "google ads for tradies", "more leads", "tradie marketing",
        "home service marketing", "get more customers", "trade business leads",
        "contractor marketing", "quotes and enquiries", "marketing for trades",
      ],
      "Trade Business": [
        "electrician marketing", "solar marketing", "plumber marketing", "trade business growth",
        "contractor business", "grow a trade business", "tradie business", "small business marketing",
        "australian trades", "trade business owner",
      ],
    },
  },

  // LachlanCB — @Lachlan-AI. AI is the product; global builder/agency-owner audience.
  ai: {
    key: "ai",
    label: "YouTube AI",
    brand: "LachlanCB",
    handle: "@Lachlan-AI",
    url: "https://www.youtube.com/@Lachlan-AI",
    aiContext:
      "YouTube channel about AI automation, Claude Code, n8n, and agency business. Audience: Western agency owners and founders (AU/US/UK) who are buying into AI as the tool. Creator: Lachy, a Chiang Mai-based solopreneur.",
    // AI channel keeps the LEGACY keys so existing board/scripts/tags carry over.
    postsKey: "content-os-youtube-posts",
    scriptsKey: "content-os-yt-scripts",
    tagsKey: "content-os-youtube-tags-v2",
    seedSamples: true,
    tagDefaults: {
      "AI Automation": [
        "ai automation", "n8n", "claude", "ai tools", "automation workflow",
        "no-code automation", "business automation", "ai agent", "workflow automation",
        "claude code",
      ],
      "Business & Agency": [
        "online business", "solopreneur", "agency", "digital marketing",
        "passive income", "entrepreneurship", "business systems", "make money online",
        "ai agency", "saas",
      ],
      "Tech & Development": [
        "coding", "developer tools", "ai coding", "python", "typescript",
        "docker", "vps", "api", "programming", "tech tutorial",
      ],
    },
  },
};
