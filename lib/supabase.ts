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
  private initializationPromise: Promise<void> | null = null;
  
  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase environment variables');
      console.error('Please add to your .env file:');
      console.error('');
      console.error('NEXT_PUBLIC_SUPABASE_URL=your_supabase_url');
      console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key');
      throw new Error('Missing Supabase environment variables. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env file');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
    console.log('🔗 Supabase client created successfully');
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;
    
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    
    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  private async performInitialization(): Promise<void> {
    try {
      console.log('🔄 Initializing Supabase database connection...');
      
      // Test connection by trying to query the deals table
      const { data, error } = await this.supabase
        .from('deals')
        .select('count', { count: 'exact', head: true });

      if (error) {
        if (error.code === 'PGRST106' || error.message.includes('relation "deals" does not exist')) {
          console.error('❌ Database tables not found!');
          console.error('🔧 Please run this SQL in your Supabase dashboard:');
          console.error('');
          console.error(this.getSetupSQL());
          console.error('');
          throw new Error('Database table "deals" does not exist. Please run the setup SQL in your Supabase dashboard.');
        } else {
          console.error('❌ Database connection error:', error);
          throw new Error(`Database connection failed: ${error.message}`);
        }
      }

      // Test votes table
      const { error: votesError } = await this.supabase
        .from('votes')
        .select('count', { count: 'exact', head: true });

      if (votesError && votesError.code === 'PGRST106') {
        console.error('❌ Votes table not found!');
        throw new Error('Database table "votes" does not exist. Please run the setup SQL in your Supabase dashboard.');
      }

      // Test the increment function
      try {
        await this.supabase.rpc('increment_upvotes', { article_id: 0 });
      } catch (funcError: any) {
        if (funcError.message?.includes('function increment_upvotes does not exist')) {
          console.warn('⚠️ increment_upvotes function not found - will use fallback method');
        }
      }
      
      this.initialized = true;
      console.log('✅ Supabase database initialized successfully');
      console.log(`📊 Database connection verified`);
      
    } catch (error) {
      console.error('❌ Supabase initialization failed:', error);
      this.initialized = false;
      this.initializationPromise = null;
      throw error;
    }
  }

  private getSetupSQL(): string {
    return `
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
  FOR INSERT WITH CHECK (true);`;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string; tableCount?: number }> {
    try {
      await this.ensureInitialized();
      
      const { count, error } = await this.supabase
        .from('deals')
        .select('*', { count: 'exact', head: true });

      if (error) {
        return { success: false, message: `Connection test failed: ${error.message}` };
      }

      return { 
        success: true, 
        message: 'Supabase connection successful', 
        tableCount: count || 0 
      };
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown connection error' 
      };
    }
  }

  async saveDeal(deal: Omit<Deal, 'id' | 'created_at' | 'upvotes'>): Promise<number> {
    try {
      await this.ensureInitialized();
      
      console.log(`💾 Saving deal to Supabase: "${deal.title.substring(0, 50)}..."`);
      
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
        console.error('❌ Failed to save deal to Supabase:', error);
        throw new Error(`Failed to save deal: ${error.message}`);
      }

      console.log(`✅ Deal saved to Supabase with ID: ${data.id}`);
      return data.id;
    } catch (error) {
      console.error('❌ Error in saveDeal:', error);
      throw error;
    }
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
      console.error('❌ Failed to get deals by date:', error);
      throw new Error(`Failed to get deals by date: ${error.message}`);
    }

    console.log(`📊 Retrieved ${data?.length || 0} deals for date ${date}`);
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
      console.error('❌ Failed to get deals by date range:', error);
      throw new Error(`Failed to get deals by date range: ${error.message}`);
    }

    console.log(`📊 Retrieved ${data?.length || 0} deals for date range ${startDate} to ${endDate}`);
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
      console.error('❌ Failed to get deals by category:', error);
      throw new Error(`Failed to get deals by category: ${error.message}`);
    }

    return data || [];
  }

  async upvoteArticle(articleId: number, userIp: string): Promise<boolean> {
    await this.ensureInitialized();
    
    try {
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

      // Try to use the increment function first
      try {
        const { error: updateError } = await this.supabase.rpc('increment_upvotes', {
          article_id: articleId
        });

        if (updateError) {
          throw new Error('RPC function not available');
        }
      } catch (rpcError) {
        // Fallback: manual increment
        console.log('Using manual upvote increment (RPC function not available)');
        
        // Get current upvote count
        const { data: currentData, error: getCurrentError } = await this.supabase
          .from('deals')
          .select('upvotes')
          .eq('id', articleId)
          .single();

        if (getCurrentError) {
          throw new Error(`Failed to get current upvotes: ${getCurrentError.message}`);
        }

        // Increment manually
        const { error: manualUpdateError } = await this.supabase
          .from('deals')
          .update({ upvotes: (currentData.upvotes || 0) + 1 })
          .eq('id', articleId);
          
        if (manualUpdateError) {
          throw new Error(`Failed to update upvotes: ${manualUpdateError.message}`);
        }
      }

      return true;
    } catch (error) {
      console.error('❌ Error in upvoteArticle:', error);
      throw error;
    }
  }

  async getAvailableDates(): Promise<string[]> {
    await this.ensureInitialized();
    
    const { data, error } = await this.supabase
      .from('deals')
      .select('date')
      .order('date', { ascending: false });

    if (error) {
      console.error('❌ Failed to get available dates:', error);
      throw new Error(`Failed to get available dates: ${error.message}`);
    }

    // Get unique dates
    const uniqueDates = Array.from(new Set((data || []).map((d: any) => d.date as string))) as string[];
    return uniqueDates;
  }

  async getAvailableCategories(): Promise<string[]> {
    await this.ensureInitialized();
    
    const { data, error } = await this.supabase
      .from('deals')
      .select('category')
      .order('category');

    if (error) {
      console.error('❌ Failed to get available categories:', error);
      throw new Error(`Failed to get available categories: ${error.message}`);
    }

    // Get unique categories
    const uniqueCategories = Array.from(new Set((data || []).map((d: any) => d.category as string))) as string[];
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
      console.error('❌ Failed to get all deals:', error);
      throw new Error(`Failed to get all deals: ${error.message}`);
    }

    console.log(`📊 Retrieved ${data?.length || 0} total deals from Supabase`);
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
      console.error('❌ Failed to cleanup invalid articles:', error);
      throw new Error(`Failed to cleanup invalid articles: ${error.message}`);
    }

    const deletedCount = data?.length || 0;
    console.log(`🧹 Cleaned up ${deletedCount} invalid articles`);
    return deletedCount;
  }

  async deleteDeal(dealId: number): Promise<boolean> {
    await this.ensureInitialized();
    
    const { error } = await this.supabase
      .from('deals')
      .delete()
      .eq('id', dealId);

    if (error) {
      console.error('❌ Failed to delete deal:', error);
      throw new Error(`Failed to delete deal: ${error.message}`);
    }

    console.log(`🗑️ Deleted deal with ID: ${dealId}`);
    return true;
  }

  async deleteDealsByIds(dealIds: number[]): Promise<boolean> {
    await this.ensureInitialized();
    
    const { error } = await this.supabase
      .from('deals')
      .delete()
      .in('id', dealIds);

    if (error) {
      console.error('❌ Failed to delete deals:', error);
      throw new Error(`Failed to delete deals: ${error.message}`);
    }

    console.log(`🗑️ Deleted ${dealIds.length} deals with IDs: ${dealIds.join(', ')}`);
    return true;
  }
}

let dbInstance: SupabaseDatabase | null = null;

export function getSupabaseDatabase(): SupabaseDatabase {
  if (!dbInstance) {
    dbInstance = new SupabaseDatabase();
  }
  return dbInstance;
} 