import OpenAI from 'openai';

export interface NewsAnalysis {
  title: string;
  summary: string;
  category: string;
  source_url?: string;
}

export interface ExtractedNews {
  articles: NewsAnalysis[];
}

export class OpenAIService {
  private openai: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    this.openai = new OpenAI({
      apiKey: apiKey,
    });
  }

  async extractNewsArticles(newsContent: string, category: string): Promise<NewsAnalysis[]> {
    try {
      console.log(`🤖 OpenAI: Extracting articles from ${category} content (${newsContent.length} chars)`);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a financial news analyst. Extract ONLY actual news articles from the provided content.

            CRITICAL REQUIREMENTS:
            - ONLY extract articles about REAL, SPECIFIC deals, transactions, or announcements
            - Each article should be about a SPECIFIC company, deal, or event with concrete details
            - Include exact amounts, company names, and transaction details
            - Extract working source URLs when available (look for https:// links)
            - Create clean, professional summaries for finance professionals

            WHAT TO EXTRACT:
            ✅ Company credit facilities, term loans, refinancing
            ✅ Fund raises by private credit/private equity firms
            ✅ Acquisition financing and LBO deals
            ✅ Asset-based lending and working capital facilities
            ✅ CLO issuances and securitizations
            ✅ Credit rating actions on specific deals

            WHAT TO REJECT:
            ❌ "No news found for this specific date"
            ❌ "After a thorough review of available sources"
            ❌ "However, here are some relevant announcements"
            ❌ "Key Findings:" or "Conclusion:" statements
            ❌ Technical disclaimers and verbose explanations
            ❌ General market commentary without specific deals
            ❌ Any content that starts with disclaimers

            FORMAT REQUIREMENTS:
            - Title: Clean company name + deal type (max 60 characters)
            - Summary: EXACTLY 2 sentences, maximum 100 words, professional tone
            - Focus on: WHO did WHAT for HOW MUCH and WHY
            - Extract actual URLs (https://...) when mentioned in content

            SUMMARY STYLE:
            ✅ "Apollo Global Management provided a $500M credit facility to TechCorp for expansion financing. The facility includes both revolving credit and term loan components."
            ❌ Long explanations, disclaimers, or verbose descriptions

            Return as JSON with "articles" array. If no actual deals exist, return empty array.`
          },
          {
            role: 'user',
            content: `Extract clean news articles about actual deals/transactions. Focus on concise, professional summaries (2 sentences max, 100 words max). Extract working URLs:\n\n${newsContent}`
          }
        ],
        max_tokens: 4000,
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        console.log(`❌ No content from OpenAI for ${category}`);
        return [];
      }

      const parsed = JSON.parse(content);
      const articles = parsed.articles || [];
      
      // Filter out any articles that still contain unwanted content
      const filteredArticles = articles.filter((article: any) => {
        const title = article.title?.toLowerCase() || '';
        const summary = article.summary?.toLowerCase() || '';
        
        // Only skip obvious placeholder/empty content
        const isPlaceholder = 
          title.includes('news update') && title.length < 20 ||
          summary.includes('no summary available') ||
          summary.includes('no content available') ||
          summary.trim().length < 10 ||
          title.trim().length < 5;
        
        if (isPlaceholder) {
          console.log(`🚫 Skipping placeholder content: "${article.title}"`);
          return false;
        }
        
        return true;
      });
      
      const processedArticles = filteredArticles.map((article: any) => {
        // Ensure summary is concise (max 100 words, 2 sentences)
        let summary = article.summary || 'No summary available';
        const sentences = summary.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
        if (sentences.length > 2) {
          summary = sentences.slice(0, 2).join('. ') + '.';
        }
        
        // Limit to 100 words
        const words = summary.split(' ');
        if (words.length > 100) {
          summary = words.slice(0, 100).join(' ') + '...';
        }
        
        return {
          title: article.title?.substring(0, 60) || 'News Update',
          summary: summary,
          category: 'Deal Activity',
          source_url: article.source_url || undefined
        };
      });

      console.log(`🤖 Processed ${processedArticles.length} clean articles`);
      return processedArticles;
      
    } catch (error) {
      console.error(`❌ Error extracting news articles from ${category}:`, error);
      return this.createFallbackArticles(newsContent, category);
    }
  }

  private createFallbackArticles(newsContent: string, category: string): NewsAnalysis[] {
    const fallbackArticles: NewsAnalysis[] = [];
    
    // Look for actual content in bullet points or paragraphs
    const bulletPoints = newsContent.split(/•\s+/).filter(point => point.trim().length > 30);
    
    for (const point of bulletPoints) {
      // Skip only obvious disclaimers
      const isDisclaimer = 
        point.toLowerCase().includes('no news found') &&
        point.toLowerCase().includes('thorough review') &&
        point.length < 200;
      
      if (isDisclaimer) continue;
      
      // Look for any content with company names or financial terms
      const hasContent = 
        point.includes('$') || point.includes('€') || point.includes('£') ||
        point.includes('million') || point.includes('billion') ||
        point.toLowerCase().includes('credit') ||
        point.toLowerCase().includes('fund') ||
        point.toLowerCase().includes('loan') ||
        point.toLowerCase().includes('financing') ||
        point.toLowerCase().includes('investment') ||
        /[A-Z][A-Za-z\s&]+(Inc\.|Corp\.|LLC|Ltd\.|Capital|Group|Holdings|Partners)/i.test(point);
      
      if (hasContent) {
        // Extract company name or create generic title
        const companyMatch = point.match(/([A-Z][A-Za-z\s&]+?)(?:\s+(?:announces|secures|closes|provides|raises|amends|completed))/);
        const company = companyMatch ? companyMatch[1].trim() : '';
        
        const title = company && company.length > 2 ? 
          `${company} Financial Update` : 
          `Market Activity Update`;
        
        // Use the content as summary, cleaned up
        const cleanSummary = point.substring(0, 200).trim();
        if (cleanSummary.length > 20) {
          fallbackArticles.push({
            title: title.substring(0, 60),
            summary: cleanSummary + (point.length > 200 ? '...' : ''),
            category: 'Deal Activity',
            source_url: undefined
          });
          
          // Limit to avoid too many fallback articles
          if (fallbackArticles.length >= 5) break;
        }
      }
    }
    
    console.log(`🤖 Created ${fallbackArticles.length} fallback articles`);
    return fallbackArticles;
  }

  async summarizeDeals(dealContent: string): Promise<NewsAnalysis> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a financial news analyst. Create a clean, simple summary of the provided content.

            REQUIREMENTS:
            - Focus ONLY on actual deals, transactions, and announcements
            - Ignore any "no news found" disclaimers or verbose explanations
            - Create a clean, blog-style summary
            - Include specific company names and deal amounts when available
            - Keep it concise and readable

            FORMAT:
            - Title: Simple, direct headline (max 60 characters)
            - Summary: Clean description of the key deals/transactions (2-3 sentences)
            - Avoid technical jargon and disclaimers

            If the content contains no actual deals, create a brief, neutral summary without disclaimers.`
          },
          {
            role: 'user',
            content: `Create a clean summary of this financial content, focusing only on actual deals:\n\n${dealContent}`
          }
        ],
        max_tokens: 1000,
        temperature: 0.2,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(content);
      
      return {
        title: parsed.title?.substring(0, 60) || 'Market Activity Update',
        summary: parsed.summary || 'Limited market activity for this period.',
        category: 'Deal Activity',
        source_url: parsed.source_url || undefined
      };
      
    } catch (error) {
      console.error('Error with OpenAI summarization:', error);
      
      // Simple fallback without verbose disclaimers
      const hasDeals = dealContent.includes('$') || dealContent.includes('€') || dealContent.includes('£');
      
      return {
        title: 'Market Activity Update',
        summary: hasDeals ? 
          'Various market transactions and announcements reported for this period.' :
          'Limited market activity for this period.',
        category: 'Deal Activity',
        source_url: undefined
      };
    }
  }

  async generateTitle(content: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Generate a concise, professional title (max 80 characters) for a financial news summary.'
          },
          {
            role: 'user',
            content: `Generate a title for this financial news:\n\n${content.substring(0, 300)}...`
          }
        ],
        max_tokens: 50,
        temperature: 0.3
      });

             return response.choices[0]?.message?.content?.trim() || 'Financial Market Update';
    } catch (error) {
      console.error('Error generating title:', error);
      return 'Financial Market Update';
    }
  }
} 