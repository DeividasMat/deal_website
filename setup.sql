-- Create deals table
CREATE TABLE IF NOT EXISTS deals (
  id BIGSERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT,
  category TEXT DEFAULT 'Market News',
  upvotes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create votes table
CREATE TABLE IF NOT EXISTS votes (
  id BIGSERIAL PRIMARY KEY,
  article_id BIGINT NOT NULL REFERENCES deals(id),
  user_ip TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(article_id, user_ip)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_deals_date ON deals(date);
CREATE INDEX IF NOT EXISTS idx_deals_category ON deals(category);
CREATE INDEX IF NOT EXISTS idx_deals_upvotes ON deals(upvotes DESC);
CREATE INDEX IF NOT EXISTS idx_votes_article_ip ON votes(article_id, user_ip);

-- Create function for incrementing upvotes
CREATE OR REPLACE FUNCTION increment_upvotes(article_id BIGINT)
RETURNS void AS $$
BEGIN
  UPDATE deals SET upvotes = upvotes + 1 WHERE id = article_id;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Allow public read access to deals
CREATE POLICY "Public deals are viewable by everyone" ON deals
  FOR SELECT USING (true);

-- Allow public insert access to deals (for the scheduler)
CREATE POLICY "Anyone can insert deals" ON deals
  FOR INSERT WITH CHECK (true);

-- Allow public update access to deals (for upvotes)
CREATE POLICY "Anyone can update deals" ON deals
  FOR UPDATE USING (true);

-- Allow public delete access to deals (for cleanup)
CREATE POLICY "Anyone can delete deals" ON deals
  FOR DELETE USING (true);

-- Allow public access to votes
CREATE POLICY "Public votes are viewable by everyone" ON votes
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert votes" ON votes
  FOR INSERT WITH CHECK (true); 