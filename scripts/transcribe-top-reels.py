"""
Transcribe top-performing competitor reels and store in Supabase.

Pipeline:
1. Fetch top reels from 8 tracked competitors via Apify (captions + engagement)
2. Filter top 20% by engagement
3. Transcribe via Apify instagram-reel-scraper (Whisper)
4. Store in Supabase reel_scripts table
5. Extract hook (first sentence of transcript)

Usage:
  uv run --with httpx,supabase scripts/transcribe-top-reels.py

Env vars needed (set in shell or .env):
  APIFY_TOKEN
  SUPABASE_URL        (e.g. https://zxxnwjcwnjwygkijsrsp.supabase.co)
  SUPABASE_ANON_KEY
"""

import os
import sys
import time
import json
import re
from dataclasses import dataclass

import httpx
from supabase import create_client

# ── Config ──────────────────────────────────────────────────────────

APIFY_TOKEN = os.environ.get("APIFY_TOKEN", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

COMPETITORS = [
    "charlieautomates",
    "noevarner.ai",
    "nick_saraev",
    "itstylergermain",
    "simon.saysai",
    "nicholas.puru",
    "jens.heitmann",
    "tenfoldmarc",
]

SCRAPE_ACTOR = "scraping_solutions~instagram-profile-posts-scraper-no-cookies"
TRANSCRIPT_ACTOR = "apify~instagram-reel-scraper"
RESULTS_PER_PROFILE = 20
TOP_PERCENT = 0.20  # transcribe top 20%
MAX_TRANSCRIBE = 30  # cap to control costs
POLL_INTERVAL = 10   # seconds


@dataclass
class Reel:
    username: str
    caption: str
    post_url: str
    like_count: int
    comment_count: int
    view_count: int
    engagement: int


def check_env():
    missing = []
    if not APIFY_TOKEN:
        missing.append("APIFY_TOKEN")
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if not SUPABASE_KEY:
        missing.append("SUPABASE_ANON_KEY")
    if missing:
        print(f"Missing env vars: {', '.join(missing)}")
        sys.exit(1)


def apify_run(actor: str, input_data: dict, client: httpx.Client) -> str:
    """Start an Apify actor run and return the run ID."""
    url = f"https://api.apify.com/v2/acts/{actor}/runs"
    resp = client.post(url, params={"token": APIFY_TOKEN}, json=input_data, timeout=30)
    resp.raise_for_status()
    return resp.json()["data"]["id"]


def apify_wait(run_id: str, client: httpx.Client, max_wait: int = 600) -> list:
    """Poll until run finishes, then fetch dataset items."""
    url = f"https://api.apify.com/v2/actor-runs/{run_id}"
    elapsed = 0
    while elapsed < max_wait:
        resp = client.get(url, params={"token": APIFY_TOKEN}, timeout=15)
        status = resp.json()["data"]["status"]
        if status == "SUCCEEDED":
            dataset_id = resp.json()["data"]["defaultDatasetId"]
            items_url = f"https://api.apify.com/v2/datasets/{dataset_id}/items"
            items_resp = client.get(items_url, params={"token": APIFY_TOKEN}, timeout=30)
            return items_resp.json()
        if status in ("FAILED", "ABORTED", "TIMED-OUT"):
            print(f"  Run {run_id} ended with status: {status}")
            return []
        print(f"  Waiting... ({elapsed}s, status: {status})")
        time.sleep(POLL_INTERVAL)
        elapsed += POLL_INTERVAL
    print(f"  Timeout waiting for run {run_id}")
    return []


def extract_hook(transcript: str) -> str:
    """Extract the first sentence from a transcript as the hook."""
    if not transcript:
        return ""
    # Split on sentence-ending punctuation
    sentences = re.split(r'(?<=[.!?])\s+', transcript.strip())
    return sentences[0] if sentences else transcript[:100]


def classify_hook(hook: str) -> str:
    """Simple hook type classification based on patterns."""
    h = hook.lower()
    if "?" in hook:
        return "question"
    if any(w in h for w in ["stop", "don't", "never", "wrong"]):
        return "contrarian"
    if any(w in h for w in ["how i", "how to", "here's how"]):
        return "how-to"
    if re.search(r'\d+', hook):
        return "specificity"
    if any(w in h for w in ["if you", "for anyone", "this is for"]):
        return "identity"
    return "statement"


def step1_scrape_reels(client: httpx.Client) -> list[Reel]:
    """Scrape recent reels from all competitors."""
    print(f"\n{'='*60}")
    print(f"STEP 1: Scraping reels from {len(COMPETITORS)} competitors")
    print(f"{'='*60}")

    run_id = apify_run(SCRAPE_ACTOR, {
        "Usernames": COMPETITORS,
        "resultsLimit": RESULTS_PER_PROFILE,
    }, client)
    print(f"  Apify run started: {run_id}")

    items = apify_wait(run_id, client, max_wait=600)
    print(f"  Got {len(items)} total items")

    reels: list[Reel] = []
    # Debug: print field keys from first item to find URL field
    if items:
        sample = items[0]
        url_candidates = {k: str(v)[:100] for k, v in sample.items() if "url" in k.lower() or "link" in k.lower() or "short" in k.lower() or k in ("id", "inputUrl")}
        print(f"  URL-related fields in first item: {json.dumps(url_candidates, indent=2)}")
    for item in items:
        # Filter to reels only
        media = item.get("media_name") or item.get("type") or item.get("productType", "")
        if media not in ("reel", "reels", "clips"):
            # Also check by video presence
            if not item.get("videoUrl") and not item.get("isVideo"):
                continue

        likes = item.get("like_count") or item.get("likesCount") or 0
        comments = item.get("comment_count") or item.get("commentsCount") or 0
        views = item.get("videoViewCount") or item.get("videoPlayCount") or 0
        caption = item.get("text") or item.get("caption") or ""
        url = item.get("link_post") or item.get("url") or item.get("postUrl") or item.get("inputUrl") or item.get("shortCode", "")
        if url and not url.startswith("http"):
            url = f"https://www.instagram.com/reel/{url}/"
        username = item.get("username") or item.get("ownerUsername") or item.get("user", {}).get("username", "") or ""
        if not username:
            link_user = item.get("link_user", "")
            if link_user:
                username = link_user.rstrip("/").split("/")[-1]

        reels.append(Reel(
            username=username,
            caption=caption,
            post_url=url,
            like_count=likes,
            comment_count=comments,
            view_count=views,
            engagement=likes + comments,
        ))

    print(f"  Filtered to {len(reels)} reels")
    return reels


def step2_filter_top(reels: list[Reel]) -> list[Reel]:
    """Filter to top 20% by engagement."""
    print(f"\n{'='*60}")
    print(f"STEP 2: Filtering top {int(TOP_PERCENT*100)}% by engagement")
    print(f"{'='*60}")

    sorted_reels = sorted(reels, key=lambda r: r.engagement, reverse=True)
    cutoff = max(1, int(len(sorted_reels) * TOP_PERCENT))
    top = sorted_reels[:min(cutoff, MAX_TRANSCRIBE)]
    print(f"  Top {len(top)} reels selected (cutoff engagement: {top[-1].engagement if top else 0})")
    for r in top[:5]:
        print(f"    @{r.username}: {r.engagement} eng — {r.caption[:60]}...")
    return top


def step3_transcribe(reels: list[Reel], client: httpx.Client) -> list[dict]:
    """Transcribe reels via Apify instagram-reel-scraper."""
    print(f"\n{'='*60}")
    print(f"STEP 3: Transcribing {len(reels)} reels")
    print(f"{'='*60}")

    urls = [r.post_url for r in reels if r.post_url]
    if not urls:
        print("  No URLs to transcribe")
        return []

    print(f"  Sending {len(urls)} reel URLs for transcription")
    run_id = apify_run(TRANSCRIPT_ACTOR, {
        "username": urls,
        "includeTranscript": True,
    }, client)
    print(f"  Apify transcription run started: {run_id}")

    items = apify_wait(run_id, client, max_wait=900)  # transcription takes longer
    print(f"  Got {len(items)} transcription results")

    # Build lookup from original reels
    reel_map = {r.post_url: r for r in reels}

    results = []
    for item in items:
        url = item.get("url") or item.get("postUrl") or ""
        transcript = item.get("transcript") or item.get("transcription") or ""
        caption = item.get("caption") or item.get("text") or ""

        # Match back to our reel data
        reel = reel_map.get(url)

        hook = extract_hook(transcript) if transcript else extract_hook(caption)
        hook_type = classify_hook(hook) if hook else "unknown"

        results.append({
            "username": reel.username if reel else (item.get("username") or item.get("ownerUsername") or ""),
            "post_url": url,
            "caption": caption or (reel.caption if reel else ""),
            "transcript": transcript,
            "hook": hook,
            "hook_type": hook_type,
            "like_count": reel.like_count if reel else (item.get("likesCount") or 0),
            "comment_count": reel.comment_count if reel else (item.get("commentsCount") or 0),
            "view_count": reel.view_count if reel else (item.get("videoViewCount") or 0),
            "engagement_rate": 0,  # would need follower count to calculate
            "duration_seconds": int(float(item.get("videoDuration") or item.get("duration") or 0)),
        })

    transcribed = [r for r in results if r["transcript"]]
    print(f"  Successfully transcribed: {len(transcribed)}/{len(results)}")
    return results


def step4_store(results: list[dict]):
    """Store transcribed scripts in Supabase."""
    print(f"\n{'='*60}")
    print(f"STEP 4: Storing {len(results)} scripts in Supabase")
    print(f"{'='*60}")

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    stored = 0
    skipped = 0
    for r in results:
        if not r["post_url"]:
            skipped += 1
            continue
        try:
            sb.table("reel_scripts").upsert(r, on_conflict="post_url").execute()
            stored += 1
        except Exception as e:
            if "duplicate" in str(e).lower() or "conflict" in str(e).lower():
                skipped += 1
            else:
                print(f"  Error storing {r['post_url']}: {e}")
                skipped += 1

    print(f"  Stored: {stored}, Skipped: {skipped}")


def main():
    check_env()
    client = httpx.Client()

    try:
        reels = step1_scrape_reels(client)
        if not reels:
            print("No reels found. Check competitor usernames and Apify token.")
            return

        top_reels = step2_filter_top(reels)
        if not top_reels:
            print("No top reels after filtering.")
            return

        results = step3_transcribe(top_reels, client)
        if not results:
            print("No transcription results.")
            return

        step4_store(results)

        # Summary
        transcribed = [r for r in results if r["transcript"]]
        print(f"\n{'='*60}")
        print(f"DONE")
        print(f"{'='*60}")
        print(f"  Reels scraped: {len(reels)}")
        print(f"  Top reels selected: {len(top_reels)}")
        print(f"  Transcribed: {len(transcribed)}")
        print(f"  Stored in Supabase: {len(results)}")
        print(f"\n  Sample hooks:")
        for r in transcribed[:5]:
            print(f"    [{r['hook_type']}] @{r['username']}: \"{r['hook'][:80]}\"")

    finally:
        client.close()


if __name__ == "__main__":
    main()
