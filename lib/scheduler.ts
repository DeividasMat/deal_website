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

        // Skip sections that are primarily "no news found" content
        const skipPhrases = [
          'no news found',
          'no specific',
          'after a thorough review',
          'however, here are some',
          'no announcements',
          'were not found',
          'conclusion:',
          'key findings:',
          'no real, specific'
        ];
        
        const hasSkipContent = skipPhrases.some(phrase => 
          section.content.toLowerCase().includes(phrase)
        );
        
        // Check if section has actual financial content
        const hasFinancialContent = 
          section.content.includes('$') || 
          section.content.includes('€') || 
          section.content.includes('£') ||
          section.content.includes('million') ||
          section.content.includes('billion') ||
          (section.content.toLowerCase().includes('fund') && section.content.toLowerCase().includes('raises')) ||
          (section.content.toLowerCase().includes('credit') && section.content.toLowerCase().includes('facility')) ||
          section.content.toLowerCase().includes('announces') ||
          section.content.toLowerCase().includes('secures') ||
          section.content.toLowerCase().includes('closes');

        // Also check for company names to ensure it's about real deals
        const hasCompanyNames = /[A-Z][A-Za-z\s&]+(Inc\.|Corp\.|LLC|Ltd\.|Capital|Group|Holdings|Partners)/i.test(section.content);

        if (hasSkipContent && !hasFinancialContent) {
          console.log(`⚠️ Skipping section with "no news found" content: "${section.category}"`);
          continue;
        }

        // Skip sections without meaningful financial content
        if (!hasFinancialContent || (!hasCompanyNames && section.content.length < 500)) {
          console.log(`⚠️ Skipping section without sufficient financial content: "${section.category}"`);
          continue;
        }

        if (section.content && section.content.length > 100) {
          try {
            // Extract individual articles using OpenAI
            console.log(`Sending to OpenAI for extraction: ${section.content.substring(0, 200)}...`);
            const articles = await this.getOpenAIService().extractNewsArticles(section.content, section.category);
            
            console.log(`Found ${articles.length} articles in ${section.category} section:`, articles.map((a: any) => a.title));
            
            // Save each article separately with improved duplicate detection
            for (const article of articles) {
              try {
                // Validate article before saving
                const isValidArticle = 
                  article.title && 
                  article.title.trim().length > 10 &&
                  !article.title.toLowerCase().includes('news update') &&
                  !article.title.toLowerCase().includes('update 1') &&
                  !article.title.toLowerCase().includes('update 2') &&
                  article.summary && 
                  article.summary.trim().length > 30 &&
                  !article.summary.toLowerCase().includes('no summary available') &&
                  (article.summary.includes('$') || 
                   article.summary.includes('€') || 
                   article.summary.includes('£') ||
                   article.summary.includes('million') ||
                   article.summary.includes('billion') ||
                   article.summary.toLowerCase().includes('facility') ||
                   article.summary.toLowerCase().includes('credit') ||
                   article.summary.toLowerCase().includes('fund') ||
                   article.summary.toLowerCase().includes('investment'));

                if (!isValidArticle) {
                  console.log(`⚠️ Skipping invalid article: "${article.title}"`);
                  continue;
                }

                // More precise duplicate detection - check exact title matches only
                const exactDuplicate = existingDeals.some(existing => 
                  existing.title.toLowerCase().trim() === article.title.toLowerCase().trim()
                );
                
                if (!exactDuplicate) {
                  console.log(`Saving article: "${article.title}"`);
                  await db.saveDeal({
                    date,
                    title: article.title,
                    summary: article.summary,
                    content: section.content, // Keep section content for reference
                    source: 'Perplexity + OpenAI',
                    source_url: article.source_url,
                    category: article.category
                  });
                  totalArticlesSaved++;
                  console.log(`✅ Saved article: "${article.title}"`);
                } else {
                  console.log(`⚠️ Skipping exact duplicate article: "${article.title}"`);
                }
              } catch (saveError) {
                console.error(`❌ Error saving article "${article.title}":`, saveError);
              }
            }
          } catch (extractError) {
            console.error(`❌ Error extracting articles from ${section.category}:`, extractError);
            
            // Only use fallback if the section has actual financial content
            if (hasFinancialContent) {
              console.log(`Using fallback summary for ${section.category}`);
              try {
                const fallbackSummary = await this.getOpenAIService().summarizeDeals(section.content);
                
                // Check if fallback summary is duplicate
                const exactDuplicate = existingDeals.some(existing => 
                  existing.title.toLowerCase().trim() === fallbackSummary.title.toLowerCase().trim()
                );
                
                if (!exactDuplicate) {
                  await db.saveDeal({
                    date,
                    title: fallbackSummary.title,
                    summary: fallbackSummary.summary,
                    content: section.content,
                    source: 'Perplexity + OpenAI',
                    source_url: fallbackSummary.source_url,
                    category: fallbackSummary.category
                  });
                  totalArticlesSaved++;
                  console.log(`✅ Saved fallback summary: "${fallbackSummary.title}"`);
                } else {
                  console.log(`⚠️ Skipping duplicate fallback summary: "${fallbackSummary.title}"`);
                }
              } catch (fallbackError) {
                console.error(`❌ Error saving fallback summary:`, fallbackError);
              }
            } else {
              console.log(`⚠️ Skipping fallback for section without financial content`);
            }
          }
        } else {
          console.log(`⚠️ Skipping section - Category: "${section.category}", Content length: ${section.content?.length || 0}`);
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