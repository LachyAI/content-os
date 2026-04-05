-- Content OS tables

-- Instagram content pipeline
CREATE TABLE IF NOT EXISTS content_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  caption TEXT,
  format TEXT NOT NULL CHECK (format IN ('reel', 'post', 'album', 'story')),
  status TEXT NOT NULL DEFAULT 'idea' CHECK (status IN ('idea', 'scripted', 'filming', 'posted')),
  scheduled_date DATE,
  posted_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Competitor tracking
CREATE TABLE IF NOT EXISTS competitors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT,
  is_verified BOOLEAN DEFAULT false,
  profile_pic_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scraped competitor posts
CREATE TABLE IF NOT EXISTS competitor_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  competitor_id UUID REFERENCES competitors(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  caption TEXT,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  media_type TEXT NOT NULL,
  posted_at TIMESTAMPTZ,
  post_url TEXT,
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance tracking columns (added for post-performance logger)
ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS actual_likes INTEGER;
ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS actual_comments INTEGER;
ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS actual_saves INTEGER;
ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS actual_shares INTEGER;
ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS post_url TEXT;
ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS performance_notes TEXT;

-- Enable RLS
ALTER TABLE content_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_posts ENABLE ROW LEVEL SECURITY;

-- Allow all access for now (single user, no auth yet)
CREATE POLICY "Allow all on content_posts" ON content_posts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on competitors" ON competitors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on competitor_posts" ON competitor_posts FOR ALL USING (true) WITH CHECK (true);
