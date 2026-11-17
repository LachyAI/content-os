// Reads which platform a pasted post link is from, and strips share-tracking junk. No "@/" imports:
// lib/link-platform.test.mjs runs this file directly under node --test.

export type LinkPlatform =
  | "LinkedIn"
  | "Instagram"
  | "Facebook"
  | "X"
  | "Threads"
  | "TikTok"
  | "YouTube"
  | "Reddit"
  | "Other";

const HOSTS: Array<[RegExp, LinkPlatform]> = [
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, "LinkedIn"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)facebook\.com$|^fb\.watch$|^fb\.me$/, "Facebook"],
  [/(^|\.)(x|twitter)\.com$/, "X"],
  [/(^|\.)threads\.(net|com)$/, "Threads"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)youtube\.com$|^youtu\.be$/, "YouTube"],
  [/(^|\.)reddit\.com$|^redd\.it$/, "Reddit"],
];

const TRACKING = /^(utm_.*|trk|trackingId|rcm|lipi|igsh|igshid|si|fbclid|mibextid|s|t)$/i;

export function detectPlatform(input: string): { url: string; platform: LinkPlatform } | null {
  const raw = input.trim();
  if (!raw || /\s/.test(raw)) return null;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (!u.hostname.includes(".")) return null;
  for (const key of [...u.searchParams.keys()]) if (TRACKING.test(key)) u.searchParams.delete(key);
  const host = u.hostname.toLowerCase();
  const platform = HOSTS.find(([re]) => re.test(host))?.[1] ?? "Other";
  return { url: u.toString(), platform };
}
