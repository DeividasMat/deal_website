import { OpenAI } from 'openai';
import { getDatabase } from './database';

export interface SemanticDuplicateResult {
  isDuplicate: boolean;
  similarity: number;
  confidence: 'low' | 'medium' | 'high';
  reason: string;
  recommendation: 'keep_first' | 'keep_second' | 'merge' | 'keep_both';
}

export class SemanticDuplicateDetector {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
  }

  // Calculate enhanced article score prioritizing free sources
  calculateArticleScore(article: any): number {
    let score = 0;
    
    // SOURCE ACCESSIBILITY (prioritize free sources)
    if (article.source_url) {
      const url = article.source_url.toLowerCase();
      
      // FREE ACCESSIBLE SOURCES (highest priority)
      if (url.includes('reuters.com') || url.includes('yahoo.com') || 
          url.includes('marketwatch.com') || url.includes('cnbc.com') ||
          url.includes('businesswire.com') || url.includes('prnewswire.com') ||
          url.includes('seekingalpha.com') || url.includes('benzinga.com')) {
        score += 50; // Highest score for free sources
      }
      // PARTIALLY FREE SOURCES
      else if (url.includes('ft.com') || url.includes('wsj.com')) {
        score += 30; // Some free articles
      }
      // PAID SOURCES (lower priority)
      else if (url.includes('bloomberg.com')) {
        score += 20; // Bloomberg Terminal is paid
      }
      // ANY HTTPS URL
      else if (url.startsWith('https://')) {
        score += 25; // Generic free source
      }
      else {
        score += 10; // Any URL is better than none
      }
    } else {
      // No URL = much lower score
      score -= 20;
    }
    
    // SOURCE NAME QUALITY (prefer known free sources)
    if (article.source) {
      const source = article.source.toLowerCase();
      
      // FREE NEWS SOURCES
      if (source.includes('reuters') || source.includes('yahoo') || 
          source.includes('marketwatch') || source.includes('cnbc') ||
          source.includes('business wire') || source.includes('pr newswire') ||
          source.includes('seeking alpha') || source.includes('benzinga') ||
          source.includes('ainvest')) {
        score += 25;
      }
      // PAID SOURCES (lower priority)
      else if (source.includes('bloomberg terminal')) {
        score += 10; // Lower score for paid sources
      }
      else if (source.includes('bloomberg')) {
        score += 15; // Slightly better than terminal
      }
      // GENERIC SOURCES
      else if (source.includes('financial news')) {
        score += 5; // Generic source
      }
      else {
        score += 8; // Any source is better than none
      }
    }
    
    // TITLE QUALITY (specific details)
    if (article.title) {
      const title = article.title.toLowerCase();
      
      // Length bonus
      score += Math.min(article.title.length / 8, 15);
      
      // Specificity bonus
      if (title.includes('$') || title.includes('million') || title.includes('billion')) {
        score += 15;
      }
      
      // Company names
      if (title.includes('apollo') || title.includes('blackstone') || 
          title.includes('kkr') || title.includes('ares') || 
          title.includes('oaktree') || title.includes('carlyle')) {
        score += 10;
      }
      
      // Transaction details
      if (title.includes('from') && title.includes('to')) {
        score += 10; // Shows increase amount
      }
      
      // Deal types
      if (title.includes('facility') || title.includes('credit') || 
          title.includes('loan') || title.includes('financing')) {
        score += 8;
      }
    }
    
    // SUMMARY QUALITY
    if (article.summary) {
      const summaryLength = article.summary.length;
      score += Math.min(summaryLength / 15, 20);
      
      // Bold formatting bonus
      if (article.summary.includes('**')) {
        score += 8;
      }
      
      // Detailed information
      if (article.summary.includes('$') && article.summary.includes('million')) {
        score += 5;
      }
    }
    
    // ENGAGEMENT
    score += (article.upvotes || 0) * 3;
    
    // RECENCY (slight preference for newer)
    if (article.created_at) {
      const hoursAgo = (Date.now() - new Date(article.created_at).getTime()) / (1000 * 60 * 60);
      if (hoursAgo < 24) score += 5;
      else if (hoursAgo < 48) score += 3;
    }
    
    return score;
  }

  // Semantic duplicate detection using OpenAI
  async detectSemanticDuplicate(article1: any, article2: any): Promise<SemanticDuplicateResult> {
    try {
      console.log(`🔍 Comparing: "${article1.title}" vs "${article2.title}"`);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert at detecting duplicate financial news articles. Compare these two articles and determine if they report the same news story.

DUPLICATE CRITERIA:
- Same company/entity involved
- Same transaction type and amount
- Same time period (even if exact date differs)
- Same deal participants
- Same financial instruments

EXAMPLES OF DUPLICATES:
- "Geo Increases Revolving Credit Facility to $450M" vs "Geo Boosts Credit Facility to $450M from $310M"
- "Apollo Provides $500M Loan to TechCorp" vs "Apollo's $500M TechCorp Financing Deal"
- "KKR Raises $2B Fund" vs "KKR Closes $2B Private Equity Fund"

EXAMPLES OF NOT DUPLICATES:
- Different companies (even if same amount)
- Different transaction types
- Different time periods
- Different deal amounts

CONFIDENCE LEVELS:
- HIGH: Clearly the same deal/story (90%+ certain)
- MEDIUM: Likely the same deal with some differences (70-89% certain)  
- LOW: Some similarity but probably different deals (50-69% certain)

RECOMMENDATIONS:
- keep_first: Keep article 1, remove article 2
- keep_second: Keep article 2, remove article 1  
- merge: Combine information from both
- keep_both: Not duplicates, keep both

Return JSON with:
{
  "isDuplicate": boolean,
  "similarity": number (0.0-1.0),
  "confidence": "low|medium|high",
  "reason": "detailed explanation",
  "recommendation": "keep_first|keep_second|merge|keep_both",
  "keyFactors": ["list of factors that make them similar/different"]
}`
          },
          {
            role: 'user',
            content: `Compare these two articles:

ARTICLE 1:
Title: ${article1.title}
Source: ${article1.source}
URL: ${article1.source_url || 'No URL'}
Summary: ${article1.summary || 'No summary'}

ARTICLE 2:
Title: ${article2.title}
Source: ${article2.source}
URL: ${article2.source_url || 'No URL'}
Summary: ${article2.summary || 'No summary'}

Are these the same news story? Provide detailed analysis.`
          }
        ],
        max_tokens: 500,
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        isDuplicate: analysis.isDuplicate || false,
        similarity: analysis.similarity || 0,
        confidence: analysis.confidence || 'low',
        reason: analysis.reason || 'No analysis available',
        recommendation: analysis.recommendation || 'keep_both'
      };
      
    } catch (error) {
      console.error('❌ Error in semantic duplicate detection:', error);
      return {
        isDuplicate: false,
        similarity: 0,
        confidence: 'low',
        reason: 'Analysis failed',
        recommendation: 'keep_both'
      };
    }
  }

  // Find all semantic duplicates in the database
  async findAllSemanticDuplicates(limit: number = 100): Promise<Array<{
    article1: any;
    article2: any;
    analysis: SemanticDuplicateResult;
    keepArticle: any;
    deleteArticle: any;
  }>> {
    const db = getDatabase();
    const articles = await db.getAllDeals();
    
    if (articles.length < 2) {
      return [];
    }
    
    console.log(`🔍 Scanning ${articles.length} articles for semantic duplicates...`);
    
    const duplicates = [];
    let comparisons = 0;
    
    // Sort articles by date to compare recent ones first
    const sortedArticles = articles.sort((a, b) => 
      new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime()
    );
    
    // Limit articles to check (focus on recent ones)
    const articlesToCheck = sortedArticles.slice(0, limit);
    
    for (let i = 0; i < articlesToCheck.length; i++) {
      for (let j = i + 1; j < articlesToCheck.length; j++) {
        comparisons++;
        
        const article1 = articlesToCheck[i];
        const article2 = articlesToCheck[j];
        
        // Skip if articles are from very different dates (likely different stories)
        const date1 = new Date(article1.created_at || article1.date);
        const date2 = new Date(article2.created_at || article2.date);
        const daysDiff = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysDiff > 7) continue; // Skip articles more than 7 days apart
        
        // Analyze semantic similarity
        const analysis = await this.detectSemanticDuplicate(article1, article2);
        
        if (analysis.isDuplicate && analysis.similarity >= 0.7) {
          console.log(`🔍 Found semantic duplicate: "${article1.title}" vs "${article2.title}" (${(analysis.similarity * 100).toFixed(1)}%)`);
          
          // Determine which to keep based on enhanced scoring
          const score1 = this.calculateArticleScore(article1);
          const score2 = this.calculateArticleScore(article2);
          
          duplicates.push({
            article1,
            article2,
            analysis,
            keepArticle: score1 > score2 ? article1 : article2,
            deleteArticle: score1 > score2 ? article2 : article1
          });
        }
        
        // Progress logging
        if (comparisons % 10 === 0) {
          console.log(`📊 Processed ${comparisons} comparisons...`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }
    
    console.log(`✅ Semantic duplicate scan complete: ${duplicates.length} duplicates found in ${comparisons} comparisons`);
    return duplicates;
  }

  // Clean up semantic duplicates
  async cleanupSemanticDuplicates(dryRun: boolean = true): Promise<{
    found: number;
    deleted: number;
    kept: number;
    failed: number;
    details: Array<{
      deleted: any;
      kept: any;
      reason: string;
    }>;
  }> {
    console.log(`🧹 Starting semantic duplicate cleanup (${dryRun ? 'DRY RUN' : 'LIVE'})...`);
    
    const duplicates = await this.findAllSemanticDuplicates(50); // Limit to 50 articles for safety
    
    if (duplicates.length === 0) {
      console.log('✅ No semantic duplicates found');
      return { found: 0, deleted: 0, kept: 0, failed: 0, details: [] };
    }
    
    console.log(`🗑️ Found ${duplicates.length} semantic duplicate pairs to clean up`);
    
    if (dryRun) {
      console.log('🔍 DRY RUN - Preview of what would be deleted:');
      duplicates.forEach((dup, index) => {
        console.log(`\n${index + 1}. DUPLICATE PAIR (${(dup.analysis.similarity * 100).toFixed(1)}% similar):`);
        console.log(`   ✅ KEEP:   [${dup.keepArticle.id}] "${dup.keepArticle.title}"`);
        console.log(`      Score: ${this.calculateArticleScore(dup.keepArticle).toFixed(1)} | Source: ${dup.keepArticle.source} | URL: ${dup.keepArticle.source_url || 'None'}`);
        console.log(`   ❌ DELETE: [${dup.deleteArticle.id}] "${dup.deleteArticle.title}"`);
        console.log(`      Score: ${this.calculateArticleScore(dup.deleteArticle).toFixed(1)} | Source: ${dup.deleteArticle.source} | URL: ${dup.deleteArticle.source_url || 'None'}`);
        console.log(`   📝 Reason: ${dup.analysis.reason}`);
      });
      
      return { found: duplicates.length, deleted: 0, kept: 0, failed: 0, details: [] };
    }
    
    // LIVE DELETION
    const db = getDatabase();
    let deleted = 0;
    let kept = 0;
    let failed = 0;
    const details = [];
    
    for (const dup of duplicates) {
      try {
        console.log(`🗑️ Deleting: [${dup.deleteArticle.id}] "${dup.deleteArticle.title}"`);
        console.log(`✅ Keeping: [${dup.keepArticle.id}] "${dup.keepArticle.title}"`);
        
        await db.deleteDeal(dup.deleteArticle.id);
        
        deleted++;
        kept++;
        
        details.push({
          deleted: {
            id: dup.deleteArticle.id,
            title: dup.deleteArticle.title,
            source: dup.deleteArticle.source
          },
          kept: {
            id: dup.keepArticle.id,
            title: dup.keepArticle.title,
            source: dup.keepArticle.source
          },
          reason: dup.analysis.reason
        });
        
        console.log(`✅ Successfully deleted duplicate ${dup.deleteArticle.id}`);
        
        // Small delay between deletions
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`❌ Error deleting duplicate ${dup.deleteArticle.id}:`, error);
        failed++;
      }
    }
    
    console.log(`\n🎉 Semantic duplicate cleanup complete!`);
    console.log(`📊 Results: ${deleted} deleted, ${kept} kept, ${failed} failed`);
    
    return { found: duplicates.length, deleted, kept, failed, details };
  }
}

export const semanticDuplicateDetector = new SemanticDuplicateDetector(); 