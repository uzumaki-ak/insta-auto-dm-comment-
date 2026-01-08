-- ============================================
-- Instagram Automation Database Schema
-- Run this file to create all required tables
-- ============================================

-- Enable UUID extension (for generating unique IDs)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLE 1: posts
-- Stores Instagram posts/reels we want to monitor
-- ============================================
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Instagram media ID (from Graph API)
  media_id VARCHAR(255) UNIQUE NOT NULL,
  
  -- Post details
  media_type VARCHAR(50) NOT NULL, -- 'IMAGE', 'VIDEO', 'CAROUSEL_ALBUM'
  media_url TEXT, -- URL to the post
  caption TEXT,
  permalink TEXT, -- Public link to post
  
  -- Automation settings for this post
  is_active BOOLEAN DEFAULT true, -- Enable/disable automation for this post
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX idx_posts_media_id ON posts(media_id);
CREATE INDEX idx_posts_active ON posts(is_active) WHERE is_active = true;

-- ============================================
-- TABLE 2: keywords
-- Stores trigger keywords for each post
-- ============================================
CREATE TABLE IF NOT EXISTS keywords (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Link to post
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  
  -- Keyword configuration
  keyword VARCHAR(255) NOT NULL, -- e.g., "link", "price", "dm"
  case_sensitive BOOLEAN DEFAULT false,
  
  -- Response templates
  comment_reply TEXT NOT NULL, -- Reply posted on comment (e.g., "Check DM 👀")
  dm_message TEXT, -- Message sent in DM (optional)
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure no duplicate keywords per post
  UNIQUE(post_id, keyword)
);

-- Indexes for performance
CREATE INDEX idx_keywords_post_id ON keywords(post_id);
CREATE INDEX idx_keywords_keyword ON keywords(LOWER(keyword)); -- Lowercase for case-insensitive search

-- ============================================
-- TABLE 3: replied_comments
-- Tracks which users we've already replied to (CRITICAL for deduplication)
-- ============================================
CREATE TABLE IF NOT EXISTS replied_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Instagram IDs
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  comment_id VARCHAR(255) NOT NULL, -- Instagram comment ID
  user_id VARCHAR(255) NOT NULL, -- Instagram user ID who commented
  username VARCHAR(255), -- Instagram username (for logging)
  
  -- What triggered the reply
  keyword_matched VARCHAR(255),
  
  -- Actions taken
  comment_replied BOOLEAN DEFAULT false, -- Did we reply to comment?
  dm_sent BOOLEAN DEFAULT false, -- Did we send DM?
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'success', -- 'success', 'failed', 'rate_limited'
  error_message TEXT, -- If failed, why?
  
  -- Timestamps
  replied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Prevent duplicate replies to same user on same post
  UNIQUE(post_id, user_id)
);

-- Indexes for deduplication checks (MOST IMPORTANT QUERY)
CREATE INDEX idx_replied_post_user ON replied_comments(post_id, user_id);
CREATE INDEX idx_replied_comment_id ON replied_comments(comment_id);
CREATE INDEX idx_replied_at ON replied_comments(replied_at DESC);

-- ============================================
-- TABLE 4: stats (Optional - for dashboard analytics)
-- Aggregated statistics for performance monitoring
-- ============================================
CREATE TABLE IF NOT EXISTS stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  
  -- Daily aggregated stats
  date DATE NOT NULL,
  
  -- Counters
  total_comments INTEGER DEFAULT 0,
  total_replies INTEGER DEFAULT 0,
  total_dms_sent INTEGER DEFAULT 0,
  total_errors INTEGER DEFAULT 0,
  
  -- Performance metrics
  avg_response_time_ms INTEGER, -- Average time to reply
  
  -- Timestamp
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(post_id, date)
);

CREATE INDEX idx_stats_date ON stats(date DESC);

-- ============================================
-- FUNCTIONS: Auto-update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to posts table
CREATE TRIGGER update_posts_updated_at 
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply to stats table
CREATE TRIGGER update_stats_updated_at 
  BEFORE UPDATE ON stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEED DATA (Optional - for testing)
-- ============================================
-- Uncomment below to insert a test post
/*
INSERT INTO posts (media_id, media_type, caption, is_active)
VALUES (
  '1234567890_test', 
  'VIDEO', 
  'Test reel - comment "link" to get the link!',
  true
);
*/

-- ============================================
-- VIEWS (Optional - for easier querying)
-- ============================================
CREATE OR REPLACE VIEW post_stats_summary AS
SELECT 
  p.id,
  p.media_id,
  p.caption,
  COUNT(DISTINCT rc.user_id) as unique_users_replied,
  COUNT(rc.id) as total_replies,
  SUM(CASE WHEN rc.dm_sent THEN 1 ELSE 0 END) as dms_sent,
  SUM(CASE WHEN rc.status = 'failed' THEN 1 ELSE 0 END) as failed_replies,
  MAX(rc.replied_at) as last_reply_at
FROM posts p
LEFT JOIN replied_comments rc ON p.id = rc.post_id
GROUP BY p.id, p.media_id, p.caption;

-- ============================================
-- GRANT PERMISSIONS (if using Supabase RLS)
-- ============================================
-- Enable Row Level Security
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE replied_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stats ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own data
CREATE POLICY "Users can view their own posts"
  ON posts FOR SELECT
  USING (true); -- Adjust based on your auth setup

-- Service role can do everything (your backend)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;