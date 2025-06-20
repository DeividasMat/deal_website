import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface Deal {
  id?: number;
  date: string;
  title: string;
  summary: string;
  content: string;
  source: string;
  source_url?: string;
  category?: string;
  upvotes?: number;
  created_at?: string;
}

export interface Vote {
  id?: number;
  article_id: number;
  user_ip: string;
  created_at?: string;
}

class SupabaseDatabase {
  private supabase: SupabaseClient;
  private initialized: boolean = false;
  
  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env file');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.initialize();
  }

  private async initialize() {
    if (this.initialized) return;
    
    try {
      // Create deals table if it doesn't exist
      const { error: dealsError } = await this.supabase.rpc('create_deals_table_if_not_exists');
      if (dealsError && !dealsError.message.includes('already exists')) {
        console.warn('Note: Run this SQL in your Supabase dashboard to create the deals table:');
        console.log(`
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
        `);
      }
      
      this.initialized = true;
      console.log('Supabase database initialized successfully');
    } catch (error) {
      console.error('Supabase initialization error:', error);
    }
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async saveDeal(deal: Omit<Deal, 'id' | 'created_at' | 'upvotes'>): Promise<number> {
    await this.ensureInitialized();
    
    const { data, error } = await this.supabase
      .from('deals')
      .insert([{
        date: deal.date,
        title: deal.title,
        summary: deal.summary,
        content: deal.content,
        source: deal.source,
        source_url: deal.source_url || null,
        category: deal.category || 'Market News'
      }])
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to save deal: ${error.message}`);
    }

    return data.id;
  }

  async getDealsByDate(date: string): Promise<Deal[]> {
    await this.ensureInitialized();
    
    const { data, error } = await this.supabase
      .from('deals')
      .select('*')
      .eq('date', date)
      .order('upvotes', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get deals by date: ${error.message}`);
    }

    return data || [];
  }

  async getDealsByDateRange(startDate: string, endDate: string): Promise<Deal[]> {
    await this.ensureInitialized();
    
    const { data, error } = await this.supabase
      .from('deals')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('upvotes', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get deals by date range: ${error.message}`);
    }

    return data || [];
  }

  async getDealsByCategory(category: string, limit: number = 15): Promise<Deal[]> {
    await this.ensureInitialized();
    
    const { data, error } = await this.supabase
      .from('deals')
      .select('*')
      .eq('category', category)
      .order('upvotes', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get deals by category: ${error.message}`);
    }

    return data || [];
  }

  async upvoteArticle(articleId: number, userIp: string): Promise<boolean> {
    await this.ensureInitialized();
    
    // Check if user already voted
    const { data: existingVote, error: checkError } = await this.supabase
      .from('votes')
      .select('id')
      .eq('article_id', articleId)
      .eq('user_ip', userIp)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw new Error(`Failed to check existing vote: ${checkError.message}`);
    }

    if (existingVote) {
      return false; // Already voted
    }

    // Add vote
    const { error: voteError } = await this.supabase
      .from('votes')
      .insert([{ article_id: articleId, user_ip: userIp }]);

    if (voteError) {
      throw new Error(`Failed to add vote: ${voteError.message}`);
    }

    // Update upvote count
    const { error: updateError } = await this.supabase.rpc('increment_upvotes', {
      article_id: articleId
    });

    if (updateError) {
      console.warn('Note: Run this SQL in your Supabase dashboard to create the increment function:');
      console.log(`
CREATE OR REPLACE FUNCTION increment_upvotes(article_id BIGINT)
RETURNS void AS $$
BEGIN
  UPDATE deals SET upvotes = upvotes + 1 WHERE id = article_id;
END;
$$ LANGUAGE plpgsql;
      `);
      
      // Fallback: manual update
      const { error: fallbackError } = await this.supabase
        .from('deals')
        .update({ upvotes: 1 }) // We'll increment manually
        .eq('id', articleId);
        
      if (fallbackError) {
        throw new Error(`Failed to update upvotes: ${fallbackError.message}`);
      }
    }

    return true;
  }

  async getAvailableDates(): Promise<string[]> {
    await this.ensureInitialized();
    
    const { data, error } = await this.supabase
      .from('deals')
      .select('date')
      .order('date', { ascending: false });

    if (error) {
      throw new Error(`Failed to get available dates: ${error.message}`);
    }

    // Get unique dates
    const uniqueDates = Array.from(new Set((data || []).map(d => d.date)));
    return uniqueDates;
  }

  async getAvailableCategories(): Promise<string[]> {
    await this.ensureInitialized();
    
    const { data, error } = await this.supabase
      .from('deals')
      .select('category')
      .order('category');

    if (error) {
      throw new Error(`Failed to get available categories: ${error.message}`);
    }

    // Get unique categories
    const uniqueCategories = Array.from(new Set((data || []).map(d => d.category)));
    return uniqueCategories;
  }

  async getAllDeals(): Promise<Deal[]> {
    await this.ensureInitialized();
    
    const { data, error } = await this.supabase
      .from('deals')
      .select('*')
      .order('upvotes', { ascending: false })
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get all deals: ${error.message}`);
    }

    return data || [];
  }

  async cleanupInvalidArticles(): Promise<number> {
    await this.ensureInitialized();
    
    // Only remove obvious placeholder content
    const { data, error } = await this.supabase
      .from('deals')
      .delete()
      .or(`title.ilike.%News Update%,summary.ilike.%No summary available%`)
      .select('id');

    if (error) {
      throw new Error(`Failed to cleanup invalid articles: ${error.message}`);
    }

    return data?.length || 0;
  }
}

let dbInstance: SupabaseDatabase | null = null;

export function getSupabaseDatabase(): SupabaseDatabase {
  if (!dbInstance) {
    dbInstance = new SupabaseDatabase();
  }
  return dbInstance;
} 