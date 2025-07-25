import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';

export interface Article {
  id: number;
  title: string;
  content: string;
  source: string;
  url: string;
  date: string;
  created_at: string;
  summary?: string;
}

export class DuplicateCleaner {
  private supabase;
  private openai: OpenAI | null = null;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
    
    // Initialize OpenAI if API key is available
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  // Normalize text for comparison
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Calculate similarity between two texts
  private calculateSimilarity(text1: string, text2: string): number {
    const norm1 = this.normalizeText(text1);
    const norm2 = this.normalizeText(text2);
    
    // Simple word-based similarity
    const words1 = norm1.split(' ');
    const words2 = norm2.split(' ');
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set(Array.from(set1).filter(x => set2.has(x)));
    const union = new Set([...Array.from(set1), ...Array.from(set2)]);
    
    return intersection.size / union.size;
  }

  // Check if two articles are duplicates
  private isDuplicate(article1: Article, article2: Article): boolean {
    // Same URL = definitely duplicate
    if (article1.url === article2.url && article1.url.length > 10) {
      return true;
    }

    // Exact title match
    if (article1.title.trim() === article2.title.trim()) {
      return true;
    }

    // Very similar titles with same source (more strict)
    const titleSimilarity = this.calculateSimilarity(article1.title, article2.title);
    if (article1.source === article2.source && titleSimilarity > 0.95) {
      return true;
    }

    // Check for minor variations in title (common duplicates)
    const normalizedTitle1 = this.normalizeTitle(article1.title);
    const normalizedTitle2 = this.normalizeTitle(article2.title);
    
    if (normalizedTitle1 === normalizedTitle2 && normalizedTitle1.length > 20) {
      return true;
    }

    // Check for URL patterns that indicate same article (more strict)
    if (article1.url && article2.url && article1.url.length > 20 && article2.url.length > 20) {
      const url1Path = article1.url.split('/').slice(-2).join('/');
      const url2Path = article2.url.split('/').slice(-2).join('/');
      if (url1Path === url2Path && url1Path.length > 10) {
        return true;
      }
    }

    return false;
  }

  // Use OpenAI to check if two articles are about the same deal
  private async checkDuplicateWithOpenAI(article1: Article, article2: Article): Promise<boolean> {
    if (!this.openai) {
      return false;
    }

    try {
      const prompt = `Compare these two financial news articles and determine if they are about the SAME deal/transaction. 

Article 1:
Title: "${article1.title}"
Source: ${article1.source}
Content: ${article1.content.substring(0, 500)}...

Article 2:
Title: "${article2.title}"
Source: ${article2.source}
Content: ${article2.content.substring(0, 500)}...

Are these articles about the SAME financial deal/transaction? Consider:
- Same company/entity names
- Same deal amount
- Same type of transaction (loan, acquisition, fund closing, etc.)
- Same timeframe

Answer with ONLY "YES" if they are about the same deal, or "NO" if they are different deals.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a financial news analyst. Analyze if two articles are about the same financial deal/transaction. Be precise and only answer YES or NO.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 10,
        temperature: 0.1
      });

      const answer = response.choices[0]?.message?.content?.trim().toUpperCase();
      return answer === 'YES';
    } catch (error) {
      console.error('OpenAI duplicate check error:', error);
      return false;
    }
  }

  // Normalize title for better comparison
  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s$]/g, '') // Keep $ for amounts
      .replace(/\s+/g, ' ')
      .replace(/\bmillion\b/g, 'm')
      .replace(/\bbillion\b/g, 'b')
      .replace(/\$(\d+)m/g, '$1 million')
      .replace(/\$(\d+)b/g, '$1 billion')
      .trim();
  }

  // Determine which article to keep from duplicates
  private getBetterArticle(article1: Article, article2: Article): Article {
    // Prefer article with more content
    if (article1.content.length > article2.content.length * 1.2) {
      return article1;
    }
    if (article2.content.length > article1.content.length * 1.2) {
      return article2;
    }

    // Prefer article with summary
    if (article1.summary && !article2.summary) {
      return article1;
    }
    if (article2.summary && !article1.summary) {
      return article2;
    }

    // Prefer more recent article
    const date1 = new Date(article1.created_at);
    const date2 = new Date(article2.created_at);
    
    return date1 > date2 ? article1 : article2;
  }

  // Find all duplicate groups with OpenAI assistance
  private async findDuplicateGroups(articles: Article[]): Promise<Article[][]> {
    const duplicateGroups: Article[][] = [];
    const processed = new Set<number>();

    console.log('🔍 Analyzing duplicates with OpenAI assistance...');

    for (let i = 0; i < articles.length; i++) {
      if (processed.has(i)) continue;

      const currentGroup = [articles[i]];
      processed.add(i);

      for (let j = i + 1; j < articles.length; j++) {
        if (processed.has(j)) continue;

        // First check basic duplicate detection
        let isDuplicate = this.isDuplicate(articles[i], articles[j]);
        
        // If not a basic duplicate, check with OpenAI for sophisticated analysis
        if (!isDuplicate && this.openai) {
          const titleSimilarity = this.calculateSimilarity(articles[i].title, articles[j].title);
          
          // Only use OpenAI for potentially similar articles to avoid excessive API calls
          if (titleSimilarity > 0.6 || articles[i].source === articles[j].source) {
            isDuplicate = await this.checkDuplicateWithOpenAI(articles[i], articles[j]);
            
            if (isDuplicate) {
              console.log(`   🤖 OpenAI detected duplicate: "${articles[i].title}" & "${articles[j].title}"`);
            }
          }
        }

        if (isDuplicate) {
          currentGroup.push(articles[j]);
          processed.add(j);
        }
      }

      // Only add groups with actual duplicates
      if (currentGroup.length > 1) {
        duplicateGroups.push(currentGroup);
      }
    }

    return duplicateGroups;
  }

  // Clean duplicates from database
  async cleanDatabase(): Promise<{
    duplicatesFound: number;
    duplicatesRemoved: number;
    articlesKept: number;
    details: Array<{
      duplicateCount: number;
      keptArticle: string;
      removedArticles: string[];
    }>;
  }> {
    console.log('🧹 Starting database duplicate cleanup...');
    
    // Get all articles from database
    const { data: articles, error } = await this.supabase
      .from('deals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching articles:', error);
      throw error;
    }

    if (!articles || articles.length === 0) {
      console.log('📊 No articles found in database');
      return {
        duplicatesFound: 0,
        duplicatesRemoved: 0,
        articlesKept: 0,
        details: []
      };
    }

    console.log(`📊 Found ${articles.length} total articles`);

    // Find duplicate groups
    const duplicateGroups = await this.findDuplicateGroups(articles);
    console.log(`🔍 Found ${duplicateGroups.length} duplicate groups`);

    if (duplicateGroups.length === 0) {
      console.log('✅ No duplicates found');
      return {
        duplicatesFound: 0,
        duplicatesRemoved: 0,
        articlesKept: 0,
        details: []
      };
    }

    let totalDuplicatesRemoved = 0;
    let totalArticlesKept = 0;
    const details: Array<{
      duplicateCount: number;
      keptArticle: string;
      removedArticles: string[];
    }> = [];

    // Process each duplicate group
    for (const group of duplicateGroups) {
      console.log(`\n🔄 Processing duplicate group with ${group.length} articles`);
      
      // Find the best article to keep
      let bestArticle = group[0];
      for (let i = 1; i < group.length; i++) {
        bestArticle = this.getBetterArticle(bestArticle, group[i]);
      }

      // Get articles to remove
      const articlesToRemove = group.filter((article: Article) => article.id !== bestArticle.id);
      const idsToRemove = articlesToRemove.map((article: Article) => article.id);

      console.log(`   ✅ Keeping: "${bestArticle.title}" (ID: ${bestArticle.id})`);
      console.log(`   🗑️  Removing: ${idsToRemove.length} duplicates`);

      // Remove duplicates from database
      if (idsToRemove.length > 0) {
        const { error: deleteError } = await this.supabase
          .from('deals')
          .delete()
          .in('id', idsToRemove);

        if (deleteError) {
          console.error(`❌ Error removing duplicates:`, deleteError);
          continue;
        }

        totalDuplicatesRemoved += idsToRemove.length;
        totalArticlesKept += 1;

        details.push({
          duplicateCount: group.length,
          keptArticle: `${bestArticle.title} (ID: ${bestArticle.id})`,
          removedArticles: articlesToRemove.map((a: Article) => `${a.title} (ID: ${a.id})`)
        });
      }
    }

    console.log(`\n📊 Cleanup Summary:`);
    console.log(`   🔍 Duplicate groups found: ${duplicateGroups.length}`);
    console.log(`   🗑️  Articles removed: ${totalDuplicatesRemoved}`);
    console.log(`   ✅ Articles kept: ${totalArticlesKept}`);
    console.log(`   📈 Total articles after cleanup: ${articles.length - totalDuplicatesRemoved}`);

    return {
      duplicatesFound: duplicateGroups.length,
      duplicatesRemoved: totalDuplicatesRemoved,
      articlesKept: totalArticlesKept,
      details
    };
  }

  // Quick duplicate check for specific articles (for real-time checking)
  async checkForDuplicates(newArticle: {
    title: string;
    content: string;
    source: string;
    url: string;
  }): Promise<Article[]> {
    const { data: existingArticles, error } = await this.supabase
      .from('deals')
      .select('*')
      .or(`url.eq.${newArticle.url},title.ilike.%${newArticle.title}%`);

    if (error || !existingArticles) {
      return [];
    }

    const tempArticle: Article = {
      id: 0,
      title: newArticle.title,
      content: newArticle.content,
      source: newArticle.source,
      url: newArticle.url,
      date: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    return existingArticles.filter((existing: Article) => 
      this.isDuplicate(tempArticle, existing)
    );
  }
}

// Export singleton instance
export const duplicateCleaner = new DuplicateCleaner(); 