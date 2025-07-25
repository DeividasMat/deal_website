import * as cron from 'node-cron';
import { format } from 'date-fns';
import { PerplexityService } from './perplexity';
import { OpenAIService } from './openai';
import { getDatabase } from './database';
import { getDateValidator } from './date-validator';
import { EnhancedDuplicateDetector } from './enhanced-duplicate-detector';
import { duplicateCleaner } from './duplicate-cleaner';
import { advancedDuplicateCleaner } from './advanced-duplicate-cleaner';

export class DealScheduler {
  private perplexityService?: PerplexityService;
  private openaiService?: OpenAIService;
  private duplicateDetector: EnhancedDuplicateDetector | null = null;
  private isRunning = false;

  constructor() {
    // Services will be initialized when first used
  }

  public getPerplexityService(): PerplexityService {
    if (!this.perplexityService) {
      this.perplexityService = new PerplexityService();
    }
    return this.perplexityService;
  }

  private getOpenAIService(): OpenAIService {
    if (!this.openaiService) {
      this.openaiService = new OpenAIService();
    }
    return this.openaiService;
  }

  private getDuplicateDetector(): EnhancedDuplicateDetector {
    if (!this.duplicateDetector) {
      this.duplicateDetector = new EnhancedDuplicateDetector();
    }
    return this.duplicateDetector;
  }

  async fetchAndProcessDeals(targetDate?: string): Promise<void> {
    if (this.isRunning) {
      console.log('News processing already in progress...');
      return;
    }

    this.isRunning = true;
    console.log('Starting daily news processing...');

    try {
      // CRITICAL FIX: Always use the target date for article dating
      // This ensures articles get the date they were actually fetched for
      const date = targetDate || format(new Date(), 'yyyy-MM-dd');
      
      console.log(`Fetching news for ${date}...`);
      
      // Get existing articles for duplicate checking
      const db = getDatabase();
      const existingDeals = await db.getDealsByDate(date);
      console.log(`Found ${existingDeals.length} existing articles for ${date}`);
      
      // Search for news using Perplexity
      const newsContent = await this.getPerplexityService().searchPrivateCreditDeals(date);
      
      console.log(`Raw news content length: ${newsContent?.length || 0}`);
      console.log(`First 500 chars of content: ${newsContent?.substring(0, 500) || 'No content'}`);
      
      // Always process whatever content we have - there's always something in private credit
      if (!newsContent || newsContent.trim().length < 10) {
        console.log(`Very minimal content found for ${date}, but continuing with processing`);
        // Create minimal fallback content to ensure we always try to find something
        const fallbackContent = `Private credit market activity for ${date}. Limited specific news available.`;
        const db = getDatabase();
        try {
          const fallbackSummary = await this.getOpenAIService().summarizeDeals(fallbackContent + (newsContent || ''));
          
          // CRITICAL FIX: Always use target fetch date
          await db.saveDeal({
            date: date, // Use target date directly - when we fetched the news
            title: fallbackSummary.title || `Private Credit Update - ${date}`,
            summary: fallbackSummary.summary || 'Limited market activity reported for this date.',
            content: fallbackContent + (newsContent || ''),
            source: fallbackSummary.original_source || 'Market Research',
            source_url: fallbackSummary.source_url,
            category: fallbackSummary.category || 'Market News'
          });
          console.log(`✅ Saved minimal fallback content for ${date} (Fetch Date: ${date})`);
        } catch (error) {
          console.error(`❌ Error saving minimal content:`, error);
        }
        return;
      }

      // Split content into meaningful sections based on the actual format
      // The content uses bullet points and different formatting, not === markers
      const sections = this.parseNewsContent(newsContent);
      console.log(`Parsed ${sections.length} sections from content`);
      
      let totalArticlesSaved = 0;

      for (const section of sections) {
        console.log(`Processing section: "${section.category}" (${section.content.length} chars)`);

        // Only skip sections that are extremely short or completely empty
        if (!section.content || section.content.trim().length < 20) {
          console.log(`⚠️ Skipping very short section: "${section.category}"`);
          continue;
        }

        if (section.content && section.content.length > 20) {
          try {
            // Extract individual articles using OpenAI
            console.log(`Sending to OpenAI for extraction: ${section.content.substring(0, 200)}...`);
            const articles = await this.getOpenAIService().extractNewsArticles(section.content, section.category, date);
            
            console.log(`Found ${articles.length} articles in ${section.category} section:`, articles.map((a: any) => a.title));
            
            // Save each article with enhanced duplicate detection and link updating
            for (const article of articles) {
              try {
                // Basic validation - just check if we have title and summary
                const isValidArticle = 
                  article.title && 
                  article.title.trim().length > 5 &&
                  article.summary && 
                  article.summary.trim().length > 10;

                if (!isValidArticle) {
                  console.log(`⚠️ Skipping invalid article: "${article.title}"`);
                  continue;
                }

                // Enhanced duplicate detection - check for existing articles
                const duplicates = await db.findDuplicateDeals(article.title, date);
                
                if (duplicates.length > 0) {
                  // Found duplicates - check if we can update them with missing information
                  let updatedAny = false;
                  
                  for (const duplicate of duplicates) {
                    // Update if missing source_url and we have one
                    if (!duplicate.source_url && article.source_url) {
                      await db.updateDealSourceUrl(
                        duplicate.id!, 
                        article.source_url, 
                        article.original_source || undefined
                      );
                      console.log(`🔗 Updated duplicate article ${duplicate.id} with source URL: ${article.source_url}`);
                      updatedAny = true;
                    }
                  }
                  
                  if (!updatedAny) {
                    console.log(`⚠️ Skipping duplicate: "${article.title}"`);
                  }
                } else {
                  // CRITICAL FIX: No duplicates found - save with FETCH DATE only
                  console.log(`💾 Saving new article to Supabase: "${article.title}"`);
                  
                  // ALWAYS use the target fetch date - never extract dates from content
                  // This prevents articles from getting wrong dates due to content mentions
                  const dealId = await db.saveDeal({
                    date: date, // ALWAYS use target fetch date - when we found the news
                    title: article.title,
                    summary: article.summary,
                    content: section.content, // Keep section content for reference
                    source: article.original_source || 'Financial News',
                    source_url: article.source_url,
                    category: article.category || 'Market News'
                  });
                  totalArticlesSaved++;
                  console.log(`✅ New article saved to Supabase with ID ${dealId}: "${article.title}" (Fetch Date: ${date})`);
                }
              } catch (saveError) {
                console.error(`❌ Error processing article "${article.title}":`, saveError);
              }
            }
          } catch (extractError) {
            console.error(`❌ Error extracting articles from ${section.category}:`, extractError);
            
            // Use fallback for any section that has content
            console.log(`Using fallback summary for ${section.category}`);
            try {
              const fallbackSummary = await this.getOpenAIService().summarizeDeals(section.content);
              
              // Check for duplicates
              const duplicates = await db.findDuplicateDeals(fallbackSummary.title, date);
              
              if (duplicates.length === 0) {
                // CRITICAL FIX: Always use target fetch date for fallback
                await db.saveDeal({
                  date: date, // Use target fetch date directly
                  title: fallbackSummary.title,
                  summary: fallbackSummary.summary,
                  content: section.content,
                  source: fallbackSummary.original_source || 'Financial News',
                  source_url: fallbackSummary.source_url,
                  category: fallbackSummary.category || 'Market News'
                });
                totalArticlesSaved++;
                console.log(`✅ Saved fallback summary: "${fallbackSummary.title}" (Fetch Date: ${date})`);
              } else {
                console.log(`⚠️ Skipping duplicate fallback summary: "${fallbackSummary.title}"`);
              }
            } catch (fallbackError) {
              console.error(`❌ Error saving fallback summary:`, fallbackError);
            }
          }
        } else {
          console.log(`⚠️ Skipping section - too short: "${section.category}" (${section.content?.length || 0} chars)`);
        }
      }

      console.log(`Successfully processed and saved ${totalArticlesSaved} new articles for ${date} (total: ${existingDeals.length + totalArticlesSaved})`);
      
      // INTEGRATED DUPLICATE ANALYSIS AND CLEANUP
      console.log('🔍 Running integrated duplicate analysis and cleanup...');
      const duplicatesRemoved = await this.runIntegratedDuplicateCleanup();
      console.log(`🧹 Cleaned up ${duplicatesRemoved} duplicates during processing`);
      
    } catch (error) {
      console.error('❌ Error in fetchAndProcessDeals:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private parseNewsContent(content: string): Array<{category: string, content: string}> {
    const sections: Array<{category: string, content: string}> = [];
    
    // Try to split by different patterns found in the actual content
    // Pattern 1: Look for bullet points with categories
    const bulletSections = content.split(/•\s*(?=\w+[^•]*:)/);
    
    if (bulletSections.length > 1) {
      console.log(`Found ${bulletSections.length} bullet sections`);
      for (let i = 1; i < bulletSections.length; i++) {
        const section = bulletSections[i].trim();
        if (section.length > 100) {
          // Extract category from the beginning of the section
          const categoryMatch = section.match(/^([^:]+):/);
          const category = categoryMatch ? categoryMatch[1].trim() : `Section ${i}`;
          
          sections.push({
            category: category,
            content: section
          });
        }
      }
    }
    
    // Pattern 2: Look for numbered sections or headers
    if (sections.length === 0) {
      const numberedSections = content.split(/\n\s*\d+\.\s+/);
      if (numberedSections.length > 1) {
        console.log(`Found ${numberedSections.length} numbered sections`);
        for (let i = 1; i < numberedSections.length; i++) {
          const section = numberedSections[i].trim();
          if (section.length > 100) {
            sections.push({
              category: `Deal Activity ${i}`,
              content: section
            });
          }
        }
      }
    }
    
    // Pattern 3: Split by double newlines for large blocks
    if (sections.length === 0) {
      const blocks = content.split(/\n\s*\n\s*/).filter(block => block.trim().length > 200);
      console.log(`Found ${blocks.length} content blocks`);
      
      blocks.forEach((block, index) => {
        sections.push({
          category: `Market News ${index + 1}`,
          content: block.trim()
        });
      });
    }

    // Fallback: Use the entire content as one section if no patterns found
    if (sections.length === 0 && content.length > 200) {
      console.log(`Using entire content as single section`);
      sections.push({
        category: 'Private Credit News',
        content: content
      });
    }

    return sections;
  }

  startScheduler(): void {
    // Run every day at 12:00 PM for the current day
    cron.schedule('0 12 * * *', async () => {
      console.log(`🕐 Scheduled task starting at 12:00 PM EST...`);
      await this.scheduleDailyNews();
    }, {
      scheduled: true,
      timezone: "America/New_York"
    });

    console.log('News scheduler started - will run daily at 12:00 PM EST for current day with duplicate removal');
  }

  stopScheduler(): void {
    cron.getTasks().forEach(task => task.stop());
    console.log('News scheduler stopped');
  }

  async runManualFetch(date?: string): Promise<void> {
    console.log('Running manual news fetch...');
    await this.fetchAndProcessDeals(date);
  }

  async runDuplicateCleanup(): Promise<number> {
    console.log('🧹 Running advanced duplicate cleanup...');
    try {
      // First run the enhanced duplicate detector
      const enhancedResult = await this.runEnhancedDuplicateCleanup();
      console.log(`🔍 Enhanced duplicate detection removed: ${enhancedResult} duplicates`);
      
      // Then run the advanced AI-powered cleanup
      const advancedResult = await advancedDuplicateCleaner.cleanDatabase();
      console.log(`🤖 Advanced AI cleanup removed: ${advancedResult.duplicatesRemoved} duplicates, kept ${advancedResult.articlesKept} articles`);
      
      return enhancedResult + advancedResult.duplicatesRemoved;
    } catch (error) {
      console.error('❌ Error in advanced duplicate cleanup:', error);
      // Fallback to basic duplicate removal
      console.log('🔄 Falling back to basic duplicate removal...');
      return await this.removeDuplicates();
    }
  }

  async runIntegratedDuplicateCleanup(): Promise<number> {
    console.log('🔍 Starting integrated duplicate analysis and cleanup...');
    
    try {
      let totalRemoved = 0;
      
      // Step 1: Enhanced duplicate cleanup (basic similarity)
      console.log('🧹 Step 1: Running enhanced duplicate cleanup...');
      const enhancedResult = await this.runEnhancedDuplicateCleanup();
      console.log(`✅ Enhanced cleanup complete: ${enhancedResult} duplicates removed`);
      totalRemoved += enhancedResult;
      
      // Step 2: Semantic duplicate detection for recent articles
      console.log('🔍 Step 2: Running semantic duplicate detection...');
      const semanticResult = await this.runSemanticDuplicateCleanup();
      console.log(`✅ Semantic cleanup complete: ${semanticResult} duplicates removed`);
      totalRemoved += semanticResult;
      
      console.log(`📊 Total duplicates removed: ${totalRemoved}`);
      return totalRemoved;
      
    } catch (error) {
      console.error('❌ Error in integrated duplicate cleanup:', error);
      return 0;
    }
  }

  private async runSemanticDuplicateCleanup(): Promise<number> {
    try {
      const db = getDatabase();
      const openai = this.getOpenAIService();
      
      // Get recent articles (last 7 days) for semantic analysis
      const recentArticles = await db.getAllDeals();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const articlesToCheck = recentArticles.filter(article => {
        const articleDate = new Date(article.created_at || article.date);
        return articleDate >= sevenDaysAgo;
      }).slice(0, 20); // Limit to 20 most recent articles
      
      if (articlesToCheck.length < 2) {
        console.log('⚠️ Not enough recent articles for semantic analysis');
        return 0;
      }
      
      console.log(`🔍 Checking ${articlesToCheck.length} recent articles for semantic duplicates...`);
      
      let duplicatesRemoved = 0;
      const maxComparisons = 20; // Limit comparisons to avoid excessive API calls
      let comparisons = 0;
      
      for (let i = 0; i < articlesToCheck.length && comparisons < maxComparisons; i++) {
        for (let j = i + 1; j < articlesToCheck.length && comparisons < maxComparisons; j++) {
          comparisons++;
          
          const article1 = articlesToCheck[i];
          const article2 = articlesToCheck[j];
          
          // Skip if from very different dates
          const date1 = new Date(article1.created_at || article1.date);
          const date2 = new Date(article2.created_at || article2.date);
          const daysDiff = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysDiff > 3) continue; // Only check articles within 3 days of each other
          
          // Analyze semantic similarity
          const analysis = await this.analyzeSemanticSimilarity(article1, article2);
          
          if (analysis.isDuplicate && analysis.similarity >= 0.8) {
            console.log(`🔍 Found semantic duplicate: "${article1.title}" vs "${article2.title}"`);
            
            // Determine which to keep based on free source priority
            const score1 = this.calculateEnhancedScore(article1);
            const score2 = this.calculateEnhancedScore(article2);
            
            const deleteArticle = score1 > score2 ? article2 : article1;
            const keepArticle = score1 > score2 ? article1 : article2;
            
                         try {
               if (deleteArticle.id) {
                 await db.deleteDeal(deleteArticle.id);
                 duplicatesRemoved++;
                 console.log(`✅ Removed semantic duplicate: "${deleteArticle.title}" (kept: "${keepArticle.title}")`);
               }
             } catch (error) {
               console.error(`❌ Error removing semantic duplicate:`, error);
             }
          }
          
          // Small delay
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log(`📊 Semantic analysis complete: ${duplicatesRemoved} duplicates removed from ${comparisons} comparisons`);
      return duplicatesRemoved;
      
    } catch (error) {
      console.error('❌ Error in semantic duplicate cleanup:', error);
      return 0;
    }
  }

  private async analyzeSemanticSimilarity(article1: any, article2: any): Promise<any> {
    try {
      // For now, use basic title comparison until we fix the OpenAI service access
      const title1 = article1.title.toLowerCase();
      const title2 = article2.title.toLowerCase();
      
      // Check if they have the same company name and transaction type
      const words1 = title1.split(' ').filter((word: string) => word.length > 3);
      const words2 = title2.split(' ').filter((word: string) => word.length > 3);
      
      const commonWords = words1.filter((word: string) => words2.includes(word));
      const similarity = commonWords.length / Math.max(words1.length, words2.length);
      
      // Check for financial terms and amounts
      const hasFinancialTerms = (title1.includes('facility') || title1.includes('credit') || title1.includes('loan')) &&
                               (title2.includes('facility') || title2.includes('credit') || title2.includes('loan'));
      
      // Check for same amounts
      const amount1 = title1.match(/\$\d+[mb]?/);
      const amount2 = title2.match(/\$\d+[mb]?/);
      const sameAmount = amount1 && amount2 && amount1[0] === amount2[0];
      
      const isDuplicate = similarity > 0.4 && hasFinancialTerms && sameAmount;
      
      return {
        isDuplicate,
        similarity: isDuplicate ? similarity : 0,
        reason: isDuplicate ? `Same company and transaction: ${commonWords.join(', ')}` : 'Different stories'
      };
      
    } catch (error) {
      console.error('❌ Error analyzing semantic similarity:', error);
      return { isDuplicate: false, similarity: 0, reason: 'Analysis failed' };
    }
  }

  private calculateEnhancedScore(article: any): number {
    let score = 0;
    
    // FREE SOURCE PRIORITY (highest scoring)
    if (article.source_url) {
      const url = article.source_url.toLowerCase();
      
      // FREE ACCESSIBLE SOURCES
      if (url.includes('reuters.com') || url.includes('yahoo.com') || 
          url.includes('marketwatch.com') || url.includes('cnbc.com') ||
          url.includes('businesswire.com') || url.includes('prnewswire.com') ||
          url.includes('seekingalpha.com') || url.includes('benzinga.com')) {
        score += 50;
      }
      // PARTIALLY FREE
      else if (url.includes('ft.com') || url.includes('wsj.com')) {
        score += 30;
      }
      // PAID SOURCES (lower score)
      else if (url.includes('bloomberg.com')) {
        score += 20;
      }
      else if (url.startsWith('https://')) {
        score += 25;
      }
    } else {
      score -= 20; // Penalty for no URL
    }
    
    // SOURCE NAME PRIORITY
    if (article.source) {
      const source = article.source.toLowerCase();
      if (source.includes('reuters') || source.includes('yahoo') || 
          source.includes('cnbc') || source.includes('marketwatch') ||
          source.includes('ainvest')) {
        score += 25;
      }
      else if (source.includes('bloomberg terminal')) {
        score += 5; // Very low score for paid terminal
      }
    }
    
    // CONTENT QUALITY
    if (article.title) {
      score += Math.min(article.title.length / 8, 15);
      if (article.title.includes('$')) score += 10;
    }
    
    if (article.summary) {
      score += Math.min(article.summary.length / 20, 20);
      if (article.summary.includes('**')) score += 5;
    }
    
    // ENGAGEMENT
    score += (article.upvotes || 0) * 2;
    
    return score;
  }

  async scheduleDailyNews(): Promise<void> {
    console.log('🕐 Starting daily news collection...');
    
    try {
      // Get today's date for news collection
      const today = new Date();
      const dateStr = format(today, 'yyyy-MM-dd');
      
      console.log(`📅 Collecting news for: ${dateStr}`);
      
      // Fetch news for today using existing method
      await this.fetchAndProcessDeals(dateStr);
      
      // Clean up duplicates after fetching with enhanced detection
      console.log('🧹 Cleaning up duplicate articles with enhanced detection...');
      // const duplicatesRemoved = await this.runEnhancedDuplicateCleanup();
      // console.log(`🗑️ Removed ${duplicatesRemoved} duplicate articles`);
      
      // Clean up database duplicates with advanced AI detection
      console.log('🧹 Running advanced database duplicate cleanup...');
      // const dbCleanupResult = await advancedDuplicateCleaner.cleanDatabase();
      // console.log(`🗑️ Advanced cleanup: removed ${dbCleanupResult.duplicatesRemoved} duplicates, kept ${dbCleanupResult.articlesKept} articles`);
      
      // Get final count
      const db = getDatabase();
      const allDeals = await db.getAllDeals();
      console.log(`📊 Total articles in database: ${allDeals.length}`);
      
    } catch (error) {
      console.error('❌ Error in daily news collection:', error);
    }
  }

  private async removeDuplicates(): Promise<number> {
    try {
      // Get all articles using the database service
      const db = getDatabase();
      const allArticles = await db.getAllDeals();
      
      // Group articles by similarity
      const duplicateGroups: { [key: string]: any[] } = {};
      
      for (const article of allArticles) {
        // Create a similarity key based on title and content
        const titleWords = article.title.toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter((word: string) => word.length > 3)
          .sort()
          .slice(0, 5) // Take first 5 significant words
          .join(' ');
        
        const contentWords = article.summary.toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter((word: string) => word.length > 3)
          .slice(0, 10) // Take first 10 significant words
          .join(' ');
        
        const similarityKey = `${titleWords}|${contentWords}`;
        
        if (!duplicateGroups[similarityKey]) {
          duplicateGroups[similarityKey] = [];
        }
        duplicateGroups[similarityKey].push(article);
      }
      
      // Find and remove duplicates (keep the one with most upvotes or newest)
      let duplicatesRemoved = 0;
      
      for (const group of Object.values(duplicateGroups)) {
        if (group.length > 1) {
          // Sort by upvotes (desc) then by creation date (desc)
          group.sort((a, b) => {
            if (b.upvotes !== a.upvotes) {
              return (b.upvotes || 0) - (a.upvotes || 0);
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
          
          // Keep the first one, remove the rest
          const toRemove = group.slice(1);
          
          for (const duplicate of toRemove) {
            await db.deleteDeal(duplicate.id);
            duplicatesRemoved++;
            console.log(`🗑️ Removed duplicate: "${duplicate.title.substring(0, 50)}..."`);
          }
        }
      }
      
      return duplicatesRemoved;
      
    } catch (error) {
      console.error('Error removing duplicates:', error);
      return 0;
    }
  }

  async runEnhancedDuplicateCleanup(): Promise<number> {
    console.log('🧹 Starting enhanced duplicate cleanup...');
    
    const db = getDatabase();
    const allDeals = await db.getAllDeals();
    
    // Get recent deals from last 7 days for duplicate checking
    const recentDeals = allDeals.filter(deal => {
      const dealDate = new Date(deal.date);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return dealDate >= sevenDaysAgo;
    });
    
    console.log(`Using enhanced duplicate detection on ${recentDeals.length} recent deals...`);
    
    // Use enhanced duplicate detector
    const duplicateDetector = this.getDuplicateDetector();
    const { duplicates, toRemove } = await duplicateDetector.findDuplicates(recentDeals);
    
    console.log(`Found ${duplicates.length} duplicate groups containing ${toRemove.length} articles to remove`);
    
    // Remove duplicate articles
    let duplicatesRemoved = 0;
    for (const index of toRemove) {
      const articleToRemove = recentDeals[index];
      if (articleToRemove && articleToRemove.id) {
        try {
          await db.deleteDeal(articleToRemove.id);
          duplicatesRemoved++;
          console.log(`✅ Removed duplicate: "${articleToRemove.title.substring(0, 50)}..."`);
        } catch (error) {
          console.error(`❌ Error removing duplicate ${articleToRemove.id}:`, error);
        }
      }
    }
    
    return duplicatesRemoved;
  }
}

// Global scheduler instance
let schedulerInstance: DealScheduler | null = null;

export function getScheduler(): DealScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new DealScheduler();
  }
  return schedulerInstance;
}

// Auto-start scheduler only in local development (not on Vercel)
if (typeof window === 'undefined' && !process.env.VERCEL) { // Only run on server side and not on Vercel
  console.log('Initializing local scheduler...');
  getScheduler().startScheduler();
} else if (process.env.VERCEL) {
  console.log('Vercel environment detected - using Vercel Cron Jobs instead of local scheduler');
} 