# Supabase Migration Guide

This guide will help you migrate from SQLite to Supabase for cloud storage and better scalability.

## 1. Create Supabase Project

1. Go to [Supabase](https://app.supabase.com/)
2. Create a new project
3. Wait for the project to be ready

## 2. Environment Variables

Add these to your `.env` file:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Existing API Keys
PERPLEXITY_API_KEY=your_perplexity_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

### How to get Supabase credentials:
1. Go to your Supabase project dashboard
2. Click on **Settings** → **API**
3. Copy the **Project URL** and **anon public** key

## 3. Database Setup

Run this SQL in your Supabase **SQL Editor**:

```sql
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
```

## 4. Enable Row Level Security (Optional but Recommended)

```sql
-- Enable RLS
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

-- Allow public access to votes
CREATE POLICY "Public votes are viewable by everyone" ON votes
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert votes" ON votes
  FOR INSERT WITH CHECK (true);
```

## 5. Data Migration (Optional)

If you have existing SQLite data to migrate:

1. Export your SQLite data:
```bash
sqlite3 database.sqlite ".dump deals" > deals_export.sql
sqlite3 database.sqlite ".dump votes" > votes_export.sql
```

2. Convert the SQLite INSERT statements to PostgreSQL format
3. Run the converted SQL in your Supabase SQL Editor

## 6. Test the Connection

1. Restart your Next.js application
2. Check the console for "Supabase database initialized successfully"
3. Try fetching news to test the integration

## 7. Benefits of Supabase

- ✅ **Cloud Storage**: No local database files
- ✅ **Scalability**: Handle thousands of articles
- ✅ **Real-time**: Built-in real-time subscriptions
- ✅ **Backup**: Automatic backups and point-in-time recovery
- ✅ **Performance**: Optimized PostgreSQL with indexes
- ✅ **Security**: Row Level Security and API authentication
- ✅ **Dashboard**: Web interface to view and manage data

## Troubleshooting

### Error: Missing Supabase environment variables
- Make sure you've added the environment variables to your `.env` file
- Restart your development server after adding variables

### Error: relation "deals" does not exist
- Run the SQL setup commands in your Supabase SQL Editor
- Make sure the tables are created successfully

### Error: permission denied for table deals
- Check that Row Level Security policies are set up correctly
- Ensure your anon key has the right permissions

## Support

If you encounter issues:
1. Check the Supabase logs in your dashboard
2. Verify your environment variables
3. Ensure the SQL setup was run successfully 