// ClearScale competitor audit — shared types and grading.
//
// The grades drive BOTH the cell colours and the Action Items list, so a
// failing cell can never appear without a matching action; the two cannot
// drift apart.
//
// Mirrors scripts/clearscale_audit_collect.py + _render.py in C:\Dev, which
// stay as the headless path.

export type Grade = "good" | "warn" | "bad" | "";

export interface BusinessInput {
  id: string;
  name: string;
  url: string;
  suburb: string;
  isClient: boolean;
}

export interface Keywords {
  primary: string;
  geo: string;
  secondary: string[];
}

export interface OnPage {
  url: string;
  finalUrl: string;
  status: number;
  metaTitle: string;
  titleLen: number;
  keywordInTitle: string;
  h1: string;
  keywordInH1: string;
  h2Count: number;
  keywordInH2s: string;
  wordCount: number;
  keywordInContent: string;
  densityPrimary: number;
  densityGeo: number;
  densitySecondary: number;
  metaDescription: string;
  metaDescLen: number;
  rendering: string;
  schemaTypes: string[];
  hasLocalBusinessSchema: boolean;
  sitemapUrls: number;
  clickToCall: boolean;
  viewport: boolean;
  cms: string;
  error: string;
}

export interface Gbp {
  query: string;
  found: boolean;
  title: string;
  category: string;
  categories: string[];
  claimed: string;
  rating: number;
  reviews: number;
  photos: number;
  address: string;
  serviceArea: boolean;
  website: string;
  phone: string;
  hoursSet: boolean;
  descriptionLen: number;
  error: string;
}

export interface RankingCell {
  arp: number | null;
  atrp: number | null;
  solv: number | null;
}

export interface RankingRow {
  keyword: string;
  byBusiness: Record<string, RankingCell>;
}

export interface Audit {
  id: string;
  slug: string;
  market: string;
  keywords: Keywords;
  businesses: BusinessInput[];
  onpage: Record<string, OnPage>;
  gbp: Record<string, Gbp>;
  rankings: RankingRow[];
  scanSettings: { grid: string; radius: string; centre: string; runAt: string };
  collectedAt: string;
}

export const NOT_COLLECTED = "— not collected —";

type Cell = [string, Grade];

const yesNo = (flag: boolean, bad: Grade = "bad"): Cell =>
  flag ? ["Yes", "good"] : ["No", bad];

const kwCell = (v: string): Cell => [v || "—", v.startsWith("Yes") ? "good" : "bad"];

const pct = (v: number): Cell => [`${v.toFixed(2)}%`, v >= 0.4 && v <= 3.0 ? "good" : "warn"];

export const ONPAGE_ROWS: { label: string; fn: (o: OnPage) => Cell }[] = [
  { label: "Website URL", fn: (o) => [o.finalUrl || o.url, ""] },
  {
    label: "Rendering (what Google receives)",
    fn: (o) => [
      o.rendering,
      o.rendering.startsWith("Client-side") ? "bad" : o.rendering.startsWith("Thin") ? "warn" : "good",
    ],
  },
  {
    label: "LocalBusiness / Service schema",
    fn: (o) =>
      o.hasLocalBusinessSchema
        ? [o.schemaTypes.slice(0, 4).join(", "), "good"]
        : [`${o.schemaTypes.slice(0, 4).join(", ") || "— none —"}  (no LocalBusiness)`, "bad"],
  },
  {
    label: "Sitemap page count",
    fn: (o) =>
      o.sitemapUrls < 0
        ? ["unreachable", "warn"]
        : o.sitemapUrls === 0
          ? ["— none —", "bad"]
          : [`${o.sitemapUrls} URLs`, o.sitemapUrls >= 5 ? "good" : "warn"],
  },
  { label: "Click-to-call link", fn: (o) => yesNo(o.clickToCall) },
  {
    label: "Meta Title",
    fn: (o) =>
      !o.metaTitle
        ? ["— missing —", "bad"]
        : [`${o.metaTitle}  (${o.titleLen} chars)`, o.titleLen >= 20 && o.titleLen <= 65 ? "good" : "warn"],
  },
  { label: "Keyword in Meta Title", fn: (o) => kwCell(o.keywordInTitle) },
  { label: "H1 Tag", fn: (o) => [o.h1 || "— missing —", o.h1 ? "good" : "bad"] },
  { label: "Keyword in H1", fn: (o) => kwCell(o.keywordInH1) },
  {
    label: "Keyword Frequency in H2s",
    fn: (o) => {
      const hits = o.keywordInH2s.includes(" of ") ? parseInt(o.keywordInH2s, 10) || 0 : 0;
      return [o.keywordInH2s, hits >= 1 ? "good" : "warn"];
    },
  },
  {
    label: "Total Word Count",
    fn: (o) => [
      o.wordCount.toLocaleString(),
      o.wordCount >= 600 ? "good" : o.wordCount >= 300 ? "warn" : "bad",
    ],
  },
  { label: "Keyword in Content", fn: (o) => kwCell(o.keywordInContent) },
  { label: "KW Density — primary", fn: (o) => pct(o.densityPrimary) },
  { label: "KW Density — geo", fn: (o) => pct(o.densityGeo) },
  { label: "KW Density — secondary", fn: (o) => pct(o.densitySecondary) },
  {
    label: "Meta Description",
    fn: (o) =>
      !o.metaDescription
        ? ["— missing —", "bad"]
        : [
            `${o.metaDescription}  (${o.metaDescLen} chars)`,
            o.metaDescLen >= 70 && o.metaDescLen <= 165 ? "good" : "warn",
          ],
  },
  { label: "Mobile viewport", fn: (o) => yesNo(o.viewport) },
  { label: "CMS Platform", fn: (o) => [o.cms, ""] },
];

export const GBP_ROWS: { label: string; fn: (g: Gbp) => Cell }[] = [
  { label: "Listing found", fn: (g) => yesNo(g.found) },
  { label: "Business name on GBP", fn: (g) => [g.title || "—", ""] },
  { label: "Primary category", fn: (g) => [g.category || "— not set —", g.category ? "good" : "bad"] },
  { label: "Other categories", fn: (g) => [g.categories.slice(1, 5).join(", ") || "—", ""] },
  { label: "Claimed / verified", fn: (g) => [g.claimed || "—", g.claimed === "Claimed" ? "good" : "bad"] },
  {
    label: "Star rating",
    fn: (g) => (!g.rating ? ["—", "bad"] : [g.rating.toFixed(1), g.rating >= 4.5 ? "good" : g.rating >= 4.0 ? "warn" : "bad"]),
  },
  {
    label: "Review count",
    fn: (g) => [g.reviews.toLocaleString(), g.reviews >= 20 ? "good" : g.reviews >= 5 ? "warn" : "bad"],
  },
  { label: "Photos", fn: (g) => [g.photos.toLocaleString(), g.photos >= 20 ? "good" : "warn"] },
  { label: "Address shown", fn: (g) => [g.address || "—", ""] },
  {
    label: "Service-area business",
    fn: (g) => [g.serviceArea ? "Yes" : "No — street address public", ""],
  },
  { label: "Hours set", fn: (g) => yesNo(g.hoursSet, "warn") },
  {
    label: "Description length",
    fn: (g) => [
      g.descriptionLen ? `${g.descriptionLen} chars` : "— empty —",
      g.descriptionLen >= 250 ? "good" : "warn",
    ],
  },
  { label: "Website linked", fn: (g) => yesNo(Boolean(g.website)) },
  { label: "Phone listed", fn: (g) => yesNo(Boolean(g.phone)) },
];

// Failing rows become action items. The text is the CONSEQUENCE, never the
// fix — the fix is the conversation.
export const ACTIONS: Record<string, [string, string, string]> = {
  "Rendering (what Google receives)": ["P1", "Site is client-side rendered", "Google and AI crawlers receive a near-empty page. Nothing to rank."],
  "LocalBusiness / Service schema": ["P1", "No LocalBusiness schema", "Invisible as a local entity to Maps and AI search. Table stakes."],
  "Sitemap page count": ["P1", "No sitemap / one-page site", "Nothing to rank for service x suburb searches."],
  "Keyword in Meta Title": ["P1", "Target keyword missing from title tag", "The single strongest on-page signal, unused."],
  "Keyword in H1": ["P2", "Target keyword missing from H1", "Page does not state what it is for."],
  "Meta Title": ["P2", "Title tag missing or badly sized", "Google rewrites it, and the rewrite rarely sells."],
  "H1 Tag": ["P2", "No H1", "No stated page topic."],
  "Meta Description": ["P2", "Meta description missing or badly sized", "Lower click-through from results already won."],
  "Click-to-call link": ["P1", "No click-to-call", "Mobile visitors cannot ring in one tap. Direct lost jobs."],
  "Total Word Count": ["P2", "Thin content", "Too little text to rank for anything competitive."],
  "Keyword in Content": ["P2", "Keyword absent from body copy", "Page never says the words a customer searches."],
  "Mobile viewport": ["P1", "No mobile viewport", "Site renders desktop-width on phones."],
  "Claimed / verified": ["P1", "GBP unclaimed", "Anyone can edit it, and it cannot rank properly. Biggest easy win."],
  "Star rating": ["P1", "Rating below 4.5", "Below the threshold most customers filter on."],
  "Review count": ["P1", "Too few reviews", "Review count is a map-pack ranking factor and the main trust signal."],
  "Listing found": ["P1", "No Google Business Profile", "Absent from the map pack entirely."],
  "Primary category": ["P1", "No primary GBP category", "Google cannot classify the business."],
  Photos: ["P3", "Few GBP photos", "Lower engagement, weaker listing."],
  "Description length": ["P3", "GBP description thin or empty", "Wasted keyword-relevant real estate."],
  "Website linked": ["P2", "No website on GBP", "Breaks the path from map pack to enquiry."],
  "Phone listed": ["P1", "No phone on GBP", "Removes the highest-intent contact route."],
  "Hours set": ["P3", "Hours not set", "Listings without hours are demoted and distrusted."],
};

const PRIORITY_ORDER: Record<string, number> = { P1: 0, P2: 1, P3: 2 };

export interface MatrixRow {
  label: string;
  cells: Cell[];
}

/**
 * Build one matrix row per metric, one cell per business.
 *
 * 🔒 A payload that failed to collect grades neutral, never bad. A skipped
 * lookup or an unreachable site is an absence of evidence; grading it as a
 * failure invents findings ("GBP unclaimed") that no data supports.
 */
export function buildMatrix<T extends { error: string }>(
  rows: { label: string; fn: (p: T) => Cell }[],
  businesses: BusinessInput[],
  payloads: Record<string, T>
): MatrixRow[] {
  return rows.map(({ label, fn }) => ({
    label,
    cells: businesses.map((b): Cell => {
      const p = payloads[b.id];
      if (!p) return [NOT_COLLECTED, ""];
      if (p.error) return [NOT_COLLECTED, ""];
      return fn(p);
    }),
  }));
}

export interface ActionItem {
  priority: string;
  area: string;
  finding: string;
  cost: string;
  value: string;
  beaten: number;
  total: number;
}

export function buildActions(
  matrices: { matrix: MatrixRow[]; area: string }[],
  businesses: BusinessInput[]
): ActionItem[] {
  const clientIdx = Math.max(0, businesses.findIndex((b) => b.isClient));
  const items: ActionItem[] = [];

  for (const { matrix, area } of matrices) {
    for (const { label, cells } of matrix) {
      const cell = cells[clientIdx];
      if (!cell) continue;
      const [value, grade] = cell;
      if ((grade !== "bad" && grade !== "warn") || !ACTIONS[label]) continue;

      let [priority, finding, cost] = ACTIONS[label];
      if (grade === "warn" && priority === "P1") priority = "P2";

      const beaten = cells.filter((c, i) => i !== clientIdx && c[1] === "good").length;
      items.push({ priority, area, finding, cost, value, beaten, total: businesses.length - 1 });
    }
  }

  return items.sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9) || b.beaten - a.beaten
  );
}
