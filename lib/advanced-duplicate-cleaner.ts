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

export interface DuplicateAnalysis {
  isDuplicate: boolean;
  confidence: number;
  reason: string;
  keyFactors: string[];
}

export class AdvancedDuplicateCleaner {
  private supabase;
  private openai: OpenAI;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
    
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is required for advanced duplicate detection');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  // Extract key financial deal information from article
  private async extractDealInfo(article: Article): Promise<{
    company: string;
    dealType: string;
    amount: string;
    keyPlayers: string[];
    dealPurpose: string;
  }> {
    try {
      const prompt = `Extract key financial deal information from this article:

Title: "${article.title}"
Content: ${article.content.substring(0, 1000)}...

Extract and return ONLY a JSON object with:
- company: main company/entity involved
- dealType: type of transaction (credit facility, acquisition, fund raise, etc.)
- amount: deal amount/size
- keyPlayers: array of key parties involved
- dealPurpose: purpose/reason for the deal

Return only valid JSON, no other text.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a financial news analyst. Extract deal information and return only valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      return JSON.parse(content);
    } catch (error) {
      console.error('Error extracting deal info:', error);
      return {
        company: '',
        dealType: '',
        amount: '',
        keyPlayers: [],
        dealPurpose: ''
      };
    }
  }

  // Advanced duplicate detection using OpenAI
  private async analyzeForDuplicates(article1: Article, article2: Article): Promise<DuplicateAnalysis> {
    try {
      const prompt = `Analyze these two financial news articles to determine if they are about the SAME deal/transaction:

ARTICLE 1:
Title: "${article1.title}"
Source: ${article1.source}
Date: ${article1.date}
Content: ${article1.content.substring(0, 800)}...

ARTICLE 2:
Title: "${article2.title}"
Source: ${article2.source}
Date: ${article2.date}
Content: ${article2.content.substring(0, 800)}...

Analyze for:
1. Same company/entity (exact match or variations like "JPMorgan" vs "JPMorgan Chase")
2. Same deal amount (exact or similar amounts like $50B vs $50 billion)
3. Same transaction type (credit facility, acquisition, partnership, etc.)
4. Same timeframe/announcement
5. Same key players involved

Return ONLY a JSON object with:
{
  "isDuplicate": true/false,
  "confidence": 0-100,
  "reason": "detailed explanation",
  "keyFactors": ["factor1", "factor2", "factor3"]
}

Be strict but thorough. Consider these examples as duplicates:
- "JPMorgan's $50B Credit Push" vs "JPMorgan Chase Unleashes $50 Billion Bet on Private Credit"
- "BlackRock Acquires HPS for $12B" vs "BlackRock Completes $12 Billion HPS Deal"

Return only valid JSON, no other text.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a financial news expert specializing in identifying duplicate deal announcements. Be thorough and accurate.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 400,
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      return JSON.parse(content);
    } catch (error) {
      console.error('Error analyzing duplicates:', error);
      return {
        isDuplicate: false,
        confidence: 0,
        reason: 'Error in analysis',
        keyFactors: []
      };
    }
  }

  // Find all duplicate groups using advanced analysis (optimized)
  private async findAdvancedDuplicateGroups(articles: Article[]): Promise<{
    groups: Article[][];
    analysis: Record<string, DuplicateAnalysis>;
  }> {
    const duplicateGroups: Article[][] = [];
    const processed = new Set<number>();
    const analysis: Record<string, DuplicateAnalysis> = {};

    console.log('🔍 Starting advanced duplicate analysis with OpenAI...');
    console.log(`📊 Processing ${articles.length} articles with optimized algorithm`);

    // First pass: Group articles by basic similarity to reduce API calls
    const candidateGroups: Article[][] = [];
    
    for (let i = 0; i < articles.length; i++) {
      if (processed.has(i)) continue;

      const currentGroup = [articles[i]];
      processed.add(i);

      for (let j = i + 1; j < articles.length; j++) {
        if (processed.has(j)) continue;

        // Enhanced pre-screening
        const title1 = articles[i].title.toLowerCase();
        const title2 = articles[j].title.toLowerCase();
        
        // Check for obvious duplicates first
        if (this.isObviousDuplicate(articles[i], articles[j])) {
          console.log(`   🎯 OBVIOUS DUPLICATE: "${articles[i].title}" & "${articles[j].title}"`);
          currentGroup.push(articles[j]);
          processed.add(j);
          continue;
        }

        // Check for potential duplicates worth analyzing with OpenAI (MORE STRICT)
        const commonWords = this.getCommonWords(title1, title2);
        const hasCommonFinancialTerms = this.hasCommonFinancialTerms(title1, title2);
        
        // Much more strict criteria - need many common words AND financial terms
        if (commonWords.length >= 6 && hasCommonFinancialTerms && 
            this.calculateStringSimilarity(title1, title2) > 0.7) {
          currentGroup.push(articles[j]);
          processed.add(j);
        }
      }

      // Only add groups with potential duplicates for OpenAI analysis
      if (currentGroup.length > 1) {
        candidateGroups.push(currentGroup);
      }
    }

    console.log(`📊 Found ${candidateGroups.length} candidate groups for OpenAI analysis`);

    // Second pass: Use OpenAI to analyze each candidate group
    for (const candidateGroup of candidateGroups) {
      const confirmedGroup = [candidateGroup[0]];
      
      for (let i = 1; i < candidateGroup.length; i++) {
        const analysisKey = `${candidateGroup[0].id}-${candidateGroup[i].id}`;
        
        // Use OpenAI to confirm if it's a duplicate
        const duplicateAnalysis = await this.analyzeForDuplicates(candidateGroup[0], candidateGroup[i]);
        analysis[analysisKey] = duplicateAnalysis;

        if (duplicateAnalysis.isDuplicate && duplicateAnalysis.confidence > 70) {
          console.log(`   🎯 CONFIRMED DUPLICATE (${duplicateAnalysis.confidence}% confidence):`);
          console.log(`      "${candidateGroup[0].title}"`);
          console.log(`      "${candidateGroup[i].title}"`);
          
          confirmedGroup.push(candidateGroup[i]);
        }
      }

      // Only add groups with confirmed duplicates
      if (confirmedGroup.length > 1) {
        duplicateGroups.push(confirmedGroup);
      }
    }

    return { groups: duplicateGroups, analysis };
  }

  // Check for obvious duplicates without OpenAI
  private isObviousDuplicate(article1: Article, article2: Article): boolean {
    // Null checks
    if (!article1 || !article2) {
      return false;
    }

    // Same URL
    if (article1.url && article2.url && article1.url === article2.url && article1.url.length > 10) {
      return true;
    }

    // Exact title match
    if (article1.title && article2.title && article1.title.trim() === article2.title.trim()) {
      return true;
    }

    // Very similar titles (>95% similarity)
    if (article1.title && article2.title) {
      const similarity = this.calculateStringSimilarity(article1.title, article2.title);
      if (similarity > 0.95) {
        return true;
      }
    }

    return false;
  }

  // Calculate string similarity using Levenshtein distance
  private calculateStringSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;
    
    const matrix: number[][] = [];
    
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    
    const maxLen = Math.max(len1, len2);
    return 1 - matrix[len1][len2] / maxLen;
  }

  // Check for common financial terms that indicate same deal
  private hasCommonFinancialTerms(title1: string, title2: string): boolean {
    const financialTerms = [
      'jpmorgan', 'blackrock', 'apollo', 'kkr', 'carlyle', 'blackstone',
      'goldman sachs', 'morgan stanley', 'wells fargo', 'bank of america',
      'credit facility', 'acquisition', 'merger', 'buyout', 'ipo',
      'billion', 'million', '$', 'fund', 'partnership', 'investment'
    ];
    
    const commonTerms = financialTerms.filter(term => 
      title1.includes(term) && title2.includes(term)
    );
    
    return commonTerms.length > 0;
  }

  // Helper function to find common words
  private getCommonWords(text1: string, text2: string): string[] {
    const words1 = text1.toLowerCase().split(/\s+/).filter(word => word.length > 3);
    const words2 = text2.toLowerCase().split(/\s+/).filter(word => word.length > 3);
    
    return words1.filter(word => words2.includes(word));
  }

  // Determine which article to keep (improved logic)
  private getBestArticle(articles: Article[]): Article {
    // Score each article
    const scores = articles.map(article => {
      let score = 0;
      
      // Prefer longer, more detailed content
      score += Math.min(article.content.length / 100, 50);
      
      // Prefer articles with summaries
      if (article.summary) score += 20;
      
      // Prefer more recent articles
      const daysOld = (Date.now() - new Date(article.created_at).getTime()) / (1000 * 60 * 60 * 24);
      score += Math.max(0, 10 - daysOld);
      
      // Prefer certain sources (you can customize this)
      const preferredSources = ['Reuters', 'Bloomberg', 'Wall Street Journal', 'Financial Times'];
      if (preferredSources.some(source => article.source.includes(source))) {
        score += 15;
      }
      
      // Prefer articles with cleaner titles (fewer special characters)
      const cleanTitle = article.title.replace(/[^\w\s$]/g, '');
      const titleCleanness = cleanTitle.length / article.title.length;
      score += titleCleanness * 10;
      
      return { article, score };
    });
    
    // Sort by score and return the best one
    scores.sort((a, b) => b.score - a.score);
    return scores[0].article;
  }

  // Main cleanup function
  async cleanDatabase(): Promise<{
    duplicatesFound: number;
    duplicatesRemoved: number;
    articlesKept: number;
    details: Array<{
      duplicateCount: number;
      keptArticle: string;
      removedArticles: string[];
      confidence: number;
      reason: string;
    }>;
  }> {
    console.log('🧹 Starting advanced database duplicate cleanup...');
    
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

    // Find duplicate groups with advanced analysis
    const { groups: duplicateGroups, analysis } = await this.findAdvancedDuplicateGroups(articles);
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
      confidence: number;
      reason: string;
    }> = [];

    // Process each duplicate group
    for (const group of duplicateGroups) {
      console.log(`\n🔄 Processing duplicate group with ${group.length} articles`);
      
      // Find the best article to keep
      const bestArticle = this.getBestArticle(group);
      
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

        // Find analysis for this group (using first comparison as representative)
        const analysisKey = `${bestArticle.id}-${articlesToRemove[0].id}`;
        const groupAnalysis = analysis[analysisKey] || {
          confidence: 85,
          reason: 'Advanced duplicate detection'
        };

        details.push({
          duplicateCount: group.length,
          keptArticle: `${bestArticle.title} (ID: ${bestArticle.id})`,
          removedArticles: articlesToRemove.map((a: Article) => `${a.title} (ID: ${a.id})`),
          confidence: groupAnalysis.confidence,
          reason: groupAnalysis.reason
        });
      }
    }

    console.log(`\n📊 Advanced Cleanup Summary:`);
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

  // Quick duplicate check for new articles (prevent duplicates at insertion)
  async checkForDuplicates(newArticle: {
    title: string;
    content: string;
    source: string;
    url: string;
  }): Promise<{
    hasDuplicates: boolean;
    duplicates: Article[];
    analysis: DuplicateAnalysis[];
  }> {
    // Get recent articles (last 30 days) to check against
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentArticles, error } = await this.supabase
      .from('deals')
      .select('*')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !recentArticles) {
      return { hasDuplicates: false, duplicates: [], analysis: [] };
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

    const duplicates: Article[] = [];
    const analysis: DuplicateAnalysis[] = [];

    // Check against recent articles
    for (const existingArticle of recentArticles) {
      const duplicateAnalysis = await this.analyzeForDuplicates(tempArticle, existingArticle);
      
      if (duplicateAnalysis.isDuplicate && duplicateAnalysis.confidence > 70) {
        duplicates.push(existingArticle);
        analysis.push(duplicateAnalysis);
      }
    }

    return {
      hasDuplicates: duplicates.length > 0,
      duplicates,
      analysis
    };
  }
}

// Export singleton instance
export const advancedDuplicateCleaner = new AdvancedDuplicateCleaner(); 