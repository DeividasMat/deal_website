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
      console.log('Deal processing already in progress...');
      return;
    }

    this.isRunning = true;
    console.log('Starting daily deal processing...');

    try {
      // Use provided date or yesterday's date
      const date = targetDate || format(subDays(new Date(), 1), 'yyyy-MM-dd');
      
      console.log(`Fetching deals for ${date}...`);
      
      // Search for deals using Perplexity
      const dealContent = await this.getPerplexityService().searchPrivateCreditDeals(date);
      
      if (!dealContent || dealContent.trim().length < 50) {
        console.log(`No significant deals found for ${date}`);
        return;
      }

      // Summarize using OpenAI
      console.log('Summarizing deals with OpenAI...');
      const { title, summary } = await this.getOpenAIService().summarizeDeals(dealContent);

      // Save to database
      const db = getDatabase();
      await db.saveDeal({
        date,
        title,
        summary,
        content: dealContent,
        source: 'Perplexity + OpenAI'
      });

      console.log(`Successfully processed and saved deals for ${date}`);
    } catch (error) {
      console.error('Error processing deals:', error);
    } finally {
      this.isRunning = false;
    }
  }

  startScheduler(): void {
    // Run every day at 12:00 PM
    cron.schedule('0 12 * * *', async () => {
      console.log('Scheduled task: Fetching daily deals...');
      await this.fetchAndProcessDeals();
    }, {
      scheduled: true,
      timezone: "America/New_York"
    });

    console.log('Deal scheduler started - will run daily at 12:00 PM EST');
  }

  stopScheduler(): void {
    cron.getTasks().forEach(task => task.stop());
    console.log('Deal scheduler stopped');
  }

  async runManualFetch(date?: string): Promise<void> {
    console.log('Running manual deal fetch...');
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

// Auto-start scheduler in production (only when running, not during build)
if (process.env.NODE_ENV === 'production' && process.env.VERCEL !== '1') {
  getScheduler().startScheduler();
} 