const { createClient } = require('@supabase/supabase-js');
const { format, subDays } = require('date-fns');

// Load environment variables
require('dotenv').config();

async function setupDatabase() {
  console.log('🚀 Setting up Supabase database...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    console.log('Please add:');
    console.log('NEXT_PUBLIC_SUPABASE_URL=your_url');
    console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  console.log('✅ Connected to Supabase');
  
  // Test connection
  try {
    const { data, error } = await supabase.from('deals').select('count', { count: 'exact', head: true });
    if (error && error.message.includes('relation "deals" does not exist')) {
      console.log('❌ Database tables not found!');
      console.log('\n📋 Please run this SQL in your Supabase SQL Editor:');
      console.log(`
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
      `);
      console.log('\nThen run this script again.');
      return;
    }
    
    console.log('✅ Database tables are ready');
    console.log(`📊 Current articles count: ${data?.[0]?.count || 0}`);
    
  } catch (err) {
    console.error('❌ Database connection error:', err.message);
    return;
  }
  
  // Fetch initial data for today and yesterday
  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  
  console.log(`\n🔍 Fetching initial data for ${today} and ${yesterday}...`);
  
  for (const date of [today, yesterday]) {
    try {
      console.log(`\n📅 Fetching news for ${date}...`);
      
      const response = await fetch('http://localhost:3000/api/deals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'fetch',
          date: date
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Successfully fetched ${result.deals?.length || 0} articles for ${date}`);
      } else {
        console.log(`⚠️ No new articles found for ${date}: ${result.message || result.error}`);
      }
      
      // Wait between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`❌ Error fetching data for ${date}:`, error.message);
    }
  }
  
  // Check final count
  try {
    const { data } = await supabase.from('deals').select('count', { count: 'exact', head: true });
    console.log(`\n🎉 Setup complete! Total articles in database: ${data?.[0]?.count || 0}`);
    
    if ((data?.[0]?.count || 0) > 0) {
      console.log('✅ You can now view articles at http://localhost:3000');
    } else {
      console.log('⚠️ No articles were saved. Check your API keys and try again.');
    }
    
  } catch (err) {
    console.log('✅ Setup complete! Check your website at http://localhost:3000');
  }
}

// Run the setup
setupDatabase().catch(console.error); 