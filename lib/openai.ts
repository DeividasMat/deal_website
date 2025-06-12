import OpenAI from 'openai';

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

  async summarizeDeals(dealContent: string): Promise<{ title: string; summary: string }> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `You are a senior financial analyst specializing in private credit, alternative lending, and distressed debt markets. 
            
            Your task is to analyze comprehensive search results about private credit deal announcements and create a detailed, professional summary.
            
            Please provide:
            1. A compelling, informative title (max 80 characters) that captures the key themes
            2. A well-structured summary organized as follows:
               
            🏆 HEADLINE DEALS
            • Major transactions with specific company names, deal sizes, and transaction types
            • Direct lending, unitranche, asset-based lending, distressed debt deals
            • Include borrower names, lender names, and use cases
            
            💰 FUND ACTIVITY  
            • New private credit fund launches, first/final closings, fundraising targets
            • BDC investments, CLO issuances, alternative credit vehicles
            • Asset manager announcements from Apollo, Blackstone, KKR, Ares, Oaktree, etc.
            
            🔥 DISTRESSED & SPECIAL SITUATIONS
            • NPL acquisitions, restructuring deals, DIP financing
            • Turnaround financing, rescue capital, opportunistic investments
            • Secondary market transactions
            
            🏢 INSTITUTIONAL ACTIVITY
            • Insurance companies, pension funds, endowments entering private credit
            • Strategic partnerships, joint ventures, platform launches
            • Senior hiring, new office openings, regulatory developments
            
            📊 MARKET INTELLIGENCE
            • Deal sizes, sector focus, geographic trends
            • Pricing information, terms, covenant details where available
            • Market commentary and outlook
            
            Use specific names, amounts, and details. If limited deals found, explain market conditions.
            
            Format your response as JSON with "title" and "summary" fields.`
          },
          {
            role: 'user',
            content: `Analyze and summarize these private credit search results from multiple sources:\n\n${dealContent}`
          }
        ],
        max_tokens: 1200,
        temperature: 0.2,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(content);
      
      // Validate and enhance the response
      let title = parsed.title || 'Private Credit Market Activity';
      let summary = parsed.summary || 'Limited deal activity detected for this period.';
      
      // Ensure title is within length limit
      if (title.length > 80) {
        title = title.substring(0, 77) + '...';
      }
      
      // Add metadata footer to summary
      const timestamp = new Date().toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      
      summary += `\n\n📊 Analysis completed ${timestamp} EST using Perplexity AI + OpenAI`;
      
      return { title, summary };
      
    } catch (error) {
      console.error('Error with OpenAI summarization:', error);
      
      // Enhanced fallback summary
      const fallbackTitle = 'Private Credit Deals Update';
      let fallbackSummary = '';
      
      if (dealContent && dealContent.length > 200) {
        // Extract key information from raw content
        const lines = dealContent.split('\n').filter(line => line.trim().length > 0);
        const relevantLines = lines.slice(0, 10).join('\n');
        
        fallbackSummary = `📋 DEAL ACTIVITY SUMMARY\n\n${relevantLines}`;
        
        if (dealContent.length > 1000) {
          fallbackSummary += '\n\n[Additional details available in raw search results]';
        }
      } else {
        fallbackSummary = `📊 LIMITED ACTIVITY\n\nNo significant private credit deals or announcements detected for this date.\n\nThis could indicate:\n• Weekend or holiday period\n• Light market activity\n• Search timing limitations\n\nCheck back during business days for more comprehensive results.`;
      }
      
      return {
        title: fallbackTitle,
        summary: fallbackSummary
      };
    }
  }

  async generateTitle(dealContent: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Generate a concise, professional title (max 80 characters) for a private credit deals summary.'
          },
          {
            role: 'user',
            content: `Generate a title for these private credit deals:\n\n${dealContent.substring(0, 300)}...`
          }
        ],
        max_tokens: 50,
        temperature: 0.3
      });

      return response.choices[0]?.message?.content?.trim() || 'Private Credit Deals Summary';
    } catch (error) {
      console.error('Error generating title:', error);
      return 'Private Credit Deals Summary';
    }
  }
} 