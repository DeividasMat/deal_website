import * as cron from 'node-cron';
import { format, subDays } from 'date-fns';
import { PerplexityService } from './perplexity';
import { OpenAIService } from './openai';
import { getDatabase } from './database';

export class DealScheduler {
  private perplexityService: PerplexityService | null = null;
  private openaiService: OpenAIService | null = null;
  private isRunning = false;

  constructor() {
    // Services will be initialized when first used
  }

  private getPerplexityService(): PerplexityService {
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

  async fetchAndProcessDeals(targetDate?: string): Promise<void> {
    if (this.isRunning) {
      console.log('News processing already in progress...');
      return;
    }

    this.isRunning = true;
    console.log('Starting daily news processing...');

    try {
      // Use provided date or yesterday's date
      const date = targetDate || format(subDays(new Date(), 1), 'yyyy-MM-dd');
      
      console.log(`Fetching news for ${date}...`);
      
      // Get existing articles for duplicate checking
      const db = getDatabase();
      const existingDeals = await db.getDealsByDate(date);
      console.log(`Found ${existingDeals.length} existing articles for ${date}`);
      
      // Search for news using Perplexity
      const newsContent = await this.getPerplexityService().searchPrivateCreditDeals(date);
      
      console.log(`Raw news content length: ${newsContent?.length || 0}`);
      console.log(`First 500 chars of content: ${newsContent?.substring(0, 500) || 'No content'}`);
      
      if (!newsContent || newsContent.trim().length < 50) {
        console.log(`No significant news found for ${date}`);
        return;
      }

      // Split content into meaningful sections based on the actual format
      // The content uses bullet points and different formatting, not === markers
      const sections = this.parseNewsContent(newsContent);
      console.log(`Parsed ${sections.length} sections from content`);
      
      let totalArticlesSaved = 0;

      for (const section of sections) {
        console.log(`Processing section: "${section.category}" (${section.content.length} chars)`);

        // Only skip sections that are clearly "no news found" disclaimers
        const isDisclaimerSection = 
          section.content.toLowerCase().includes('no news found') &&
          section.content.toLowerCase().includes('thorough review') &&
          section.content.length < 300;

        if (isDisclaimerSection) {
          console.log(`⚠️ Skipping disclaimer section: "${section.category}"`);
          continue;
        }

        if (section.content && section.content.length > 50) {
          try {
            // Extract individual articles using OpenAI
            console.log(`Sending to OpenAI for extraction: ${section.content.substring(0, 200)}...`);
            const articles = await this.getOpenAIService().extractNewsArticles(section.content, section.category);
            
            console.log(`Found ${articles.length} articles in ${section.category} section:`, articles.map((a: any) => a.title));
            
            // Save each article with basic duplicate detection
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

                // Simple duplicate detection - check title similarity
                const isDuplicate = existingDeals.some(existing => {
                  const existingTitle = existing.title.toLowerCase().trim();
                  const newTitle = article.title.toLowerCase().trim();
                  
                  // Check exact match or very similar titles
                  return existingTitle === newTitle || 
                         (existingTitle.length > 10 && newTitle.length > 10 && 
                          existingTitle.includes(newTitle.substring(0, 15)) ||
                          newTitle.includes(existingTitle.substring(0, 15)));
                });
                
                if (!isDuplicate) {
                  console.log(`Saving article: "${article.title}"`);
                  await db.saveDeal({
                    date,
                    title: article.title,
                    summary: article.summary,
                    content: section.content, // Keep section content for reference
                    source: 'Perplexity + OpenAI',
                    source_url: article.source_url,
                    category: article.category || 'Deal Activity'
                  });
                  totalArticlesSaved++;
                  console.log(`✅ Saved article: "${article.title}"`);
                } else {
                  console.log(`⚠️ Skipping duplicate article: "${article.title}"`);
                }
              } catch (saveError) {
                console.error(`❌ Error saving article "${article.title}":`, saveError);
              }
            }
          } catch (extractError) {
            console.error(`❌ Error extracting articles from ${section.category}:`, extractError);
            
            // Use fallback for any section that has content
            console.log(`Using fallback summary for ${section.category}`);
            try {
              const fallbackSummary = await this.getOpenAIService().summarizeDeals(section.content);
              
              // Check if fallback summary is duplicate
              const isDuplicate = existingDeals.some(existing => {
                const existingTitle = existing.title.toLowerCase().trim();
                const newTitle = fallbackSummary.title.toLowerCase().trim();
                return existingTitle === newTitle;
              });
              
              if (!isDuplicate) {
                await db.saveDeal({
                  date,
                  title: fallbackSummary.title,
                  summary: fallbackSummary.summary,
                  content: section.content,
                  source: 'Perplexity + OpenAI',
                  source_url: fallbackSummary.source_url,
                  category: fallbackSummary.category || 'Deal Activity'
                });
                totalArticlesSaved++;
                console.log(`✅ Saved fallback summary: "${fallbackSummary.title}"`);
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
    // Run every day at 12:00 PM for the previous day
    cron.schedule('0 12 * * *', async () => {
      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      console.log(`Scheduled task: Fetching daily news for ${yesterday}...`);
      await this.fetchAndProcessDeals(yesterday);
    }, {
      scheduled: true,
      timezone: "America/New_York"
    });

    console.log('News scheduler started - will run daily at 12:00 PM EST for previous day');
  }

  stopScheduler(): void {
    cron.getTasks().forEach(task => task.stop());
    console.log('News scheduler stopped');
  }

  async runManualFetch(date?: string): Promise<void> {
    console.log('Running manual news fetch...');
    await this.fetchAndProcessDeals(date);
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

// Auto-start scheduler in all environments
if (typeof window === 'undefined') { // Only run on server side
  console.log('Initializing scheduler...');
  getScheduler().startScheduler();
} 