import { OpenAIService } from './openai';
import axios from 'axios';
import { JSDOM } from 'jsdom';

export class DateValidator {
  private openai: OpenAIService;

  constructor() {
    this.openai = new OpenAIService();
  }

  async validateArticleDate(
    title: string,
    summary: string,
    content: string,
    sourceUrl?: string,
    providedDate?: string
  ): Promise<string> {
    console.log(`🔍 Validating date for: "${title.substring(0, 50)}..."`);
    
    let validatedDate: string | null = null;
    
    // Method 1: Extract from source URL if available
    if (sourceUrl && sourceUrl.startsWith('http')) {
      try {
        validatedDate = await this.extractDateFromUrl(sourceUrl);
        if (validatedDate) {
          console.log(`📅 Found date from URL: ${validatedDate}`);
        }
      } catch (error) {
        console.log(`⚠️ URL date extraction failed: ${error}`);
      }
    }
    
    // Method 2: Extract from content using AI if URL method failed
    if (!validatedDate) {
      try {
        validatedDate = await this.extractDateFromContent(title, summary, content);
        if (validatedDate) {
          console.log(`📅 Found date from content: ${validatedDate}`);
        }
      } catch (error) {
        console.log(`⚠️ Content date extraction failed: ${error}`);
      }
    }
    
    // Method 3: Validate the provided date if no extraction worked
    if (!validatedDate && providedDate) {
      if (this.isReasonableDate(providedDate)) {
        validatedDate = providedDate;
        console.log(`📅 Using provided date: ${validatedDate}`);
      }
    }
    
    // Fallback to today's date if all methods failed
    if (!validatedDate) {
      validatedDate = new Date().toISOString().split('T')[0];
      console.log(`📅 Fallback to today's date: ${validatedDate}`);
    }
    
    return validatedDate;
  }

  private async extractDateFromUrl(url: string): Promise<string | null> {
    if (!url || !url.startsWith('http')) {
      return null;
    }
    
    try {
      // First, try to extract date from URL path
      const urlDate = this.extractDateFromUrlPath(url);
      if (urlDate) {
        console.log(`📅 Found date in URL path: ${urlDate}`);
        return urlDate;
      }
      
      // If no date in URL, try to scrape the webpage
      console.log(`🌐 Scraping URL for date: ${url.substring(0, 50)}...`);
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const dom = new JSDOM(response.data);
      const document = dom.window.document;
      
      // Try various date selectors
      const dateSelectors = [
        'time[datetime]',
        '[datetime]',
        '.date',
        '.published',
        '.article-date',
        '.post-date',
        '.timestamp',
        '[class*="date"]',
        '[class*="time"]',
        'meta[name="article:published_time"]',
        'meta[property="article:published_time"]',
        'meta[name="date"]',
        'meta[name="pubdate"]'
      ];
      
             for (const selector of dateSelectors) {
         const elements = document.querySelectorAll(selector);
         for (let i = 0; i < elements.length; i++) {
           const element = elements[i];
           const dateText = element.getAttribute('datetime') || 
                           element.getAttribute('content') || 
                           element.textContent;
           
           if (dateText) {
             const parsedDate = this.parseDate(dateText);
             if (parsedDate) {
               console.log(`📅 Found date from ${selector}: ${parsedDate}`);
               return parsedDate;
             }
           }
         }
       }
      
      // Try to find date in page text
      const pageText = document.body.textContent || '';
      const textDate = this.extractDateFromText(pageText);
      if (textDate) {
        console.log(`📅 Found date in page text: ${textDate}`);
        return textDate;
      }
      
      return null;
      
    } catch (error) {
      console.log(`⚠️ Error scraping URL: ${error}`);
      return null;
    }
  }

  private extractDateFromUrlPath(url: string): string | null {
    // Common URL date patterns
    const patterns = [
      /\/(\d{4})\/(\d{1,2})\/(\d{1,2})\//,  // /2025/01/15/
      /\/(\d{4})-(\d{1,2})-(\d{1,2})\//,    // /2025-01-15/
      /\/(\d{4})(\d{2})(\d{2})\//,          // /20250115/
      /\/articles\/(\d{4})-(\d{1,2})-(\d{1,2})/,  // /articles/2025-01-15
      /\/news\/(\d{4})\/(\d{1,2})\/(\d{1,2})/,    // /news/2025/01/15
      /\/(\d{4})\/(\d{1,2})\/(\d{1,2})/,    // /2025/01/15 (without trailing slash)
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        const year = parseInt(match[1]);
        const month = parseInt(match[2]);
        const day = parseInt(match[3]);
        
        if (year >= 2020 && year <= 2025 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        }
      }
    }
    
    return null;
  }

  private async extractDateFromContent(title: string, summary: string, content: string): Promise<string | null> {
    try {
      return await this.openai.extractDateFromContent(title, summary, content);
    } catch (error) {
      console.log(`⚠️ Error extracting date from content: ${error}`);
      return null;
    }
  }

  private extractDateFromText(text: string): string | null {
    // Look for date patterns in text
    const patterns = [
      /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/gi,
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/gi,
      /(\d{4})-(\d{1,2})-(\d{1,2})/g
    ];
    
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          const parsedDate = this.parseDate(match);
          if (parsedDate) {
            return parsedDate;
          }
        }
      }
    }
    
    return null;
  }

  private parseDate(dateString: string): string | null {
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        
        // Only return reasonable dates
        if (year >= 2020 && year <= 2025) {
          return `${year}-${month}-${day}`;
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  private isReasonableDate(dateString: string): boolean {
    try {
      const date = new Date(dateString);
      const now = new Date();
      
      // Check if date is not in the future and not more than 2 years old
      return !isNaN(date.getTime()) && 
             date <= now && 
             date >= new Date(now.getFullYear() - 2, 0, 1);
    } catch (error) {
      return false;
    }
  }
}

// Global instance
let dateValidatorInstance: DateValidator | null = null;

export function getDateValidator(): DateValidator {
  if (!dateValidatorInstance) {
    dateValidatorInstance = new DateValidator();
  }
  return dateValidatorInstance;
} 