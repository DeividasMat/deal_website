import * as cron from 'node-cron';
import { format, subDays } from 'date-fns';
import { PerplexityService } from './perplexity';
import { OpenAIService } from './openai';
import { getDatabase } from './database';
import { getDateValidator } from './date-validator';
import { EnhancedDuplicateDetector } from './enhanced-duplicate-detector';
import { duplicateCleaner } from './duplicate-cleaner';
import { advancedDuplicateCleaner } from './advanced-duplicate-cleaner';

export class DealScheduler {
  private perplexityService: PerplexityService | null = null;
  private openaiService: OpenAIService | null = null;
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
      // Use provided date or today's date
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
          
          // Use target date directly for minimal fallback content
          await db.saveDeal({
            date: date, // Use target date directly
            title: fallbackSummary.title || `Private Credit Update - ${date}`,
            summary: fallbackSummary.summary || 'Limited market activity reported for this date.',
            content: fallbackContent + (newsContent || ''),
            source: fallbackSummary.original_source || 'Market Research',
            source_url: fallbackSummary.source_url,
            category: fallbackSummary.category || 'Market News'
          });
          console.log(`✅ Saved minimal fallback content for ${date} (Date: ${date})`);
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
                    // Or update if we have a better source (more specific publication)
                    else if (duplicate.source_url && article.source_url && 
                             article.original_source && 
                             duplicate.source === 'Perplexity + OpenAI' &&
                             ['Bloomberg', 'Reuters', 'Financial Times', 'WSJ'].includes(article.original_source)) {
                      await db.updateDealSourceUrl(
                        duplicate.id!, 
                        article.source_url, 
                        article.original_source
                      );
                      console.log(`📰 Updated duplicate article ${duplicate.id} with better source: ${article.original_source}`);
                      updatedAny = true;
                    }
                  }
                  
                  if (updatedAny) {
                    console.log(`✅ Enhanced existing duplicate articles for: "${article.title}"`);
                  } else {
                    console.log(`⚠️ Skipping duplicate article (no new information): "${article.title}"`);
                  }
                } else {
                  // No duplicates found - save as new article with target date
                  console.log(`💾 Saving new article to Supabase: "${article.title}"`);
                  
                  // Use the target date directly instead of validating from content
                  // This ensures articles are saved with the correct date they were fetched for
                  const dealId = await db.saveDeal({
                    date: date, // Use target date directly
                    title: article.title,
                    summary: article.summary,
                    content: section.content, // Keep section content for reference
                    source: article.original_source || 'Financial News',
                    source_url: article.source_url,
                    category: article.category || 'Market News' // Use proper category from OpenAI
                  });
                  totalArticlesSaved++;
                  console.log(`✅ New article saved to Supabase with ID ${dealId}: "${article.title}" (Date: ${date})`);
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
                // Use target date directly for fallback article
                await db.saveDeal({
                  date: date, // Use target date directly
                  title: fallbackSummary.title,
                  summary: fallbackSummary.summary,
                  content: section.content,
                  source: fallbackSummary.original_source || 'Financial News',
                  source_url: fallbackSummary.source_url,
                  category: fallbackSummary.category || 'Market News'
                });
                totalArticlesSaved++;
                console.log(`✅ Saved fallback summary: "${fallbackSummary.title}" (Date: ${date})`);
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
    } catch (error) {
      console.error('Error processing news:', error);
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
    
    // Fallback: treat entire content as one section
    if (sections.length === 0) {
      console.log('Using entire content as single section');
      sections.push({
        category: 'Deal Activity',
        content: content
      });
    }
    
    console.log(`Parsed sections:`, sections.map(s => `${s.category} (${s.content.length} chars)`));
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