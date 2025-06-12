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
            content: `You are a financial analyst specializing in private credit markets. 
            Your task is to analyze and summarize private credit deal announcements.
            
            Please provide:
            1. A concise, informative title (max 100 characters)
            2. A structured summary highlighting:
               - Key deals and transactions
               - Notable companies and deal sizes
               - Market trends or significant developments
               - Important announcements
            
            Format your response as JSON with "title" and "summary" fields.
            Keep the summary professional and focused on the most important information.`
          },
          {
            role: 'user',
            content: `Please analyze and summarize these private credit deal announcements:\n\n${dealContent}`
          }
        ],
        max_tokens: 1000,
        temperature: 0.3,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(content);
      return {
        title: parsed.title || 'Private Credit Deals Summary',
        summary: parsed.summary || 'No significant deals found.'
      };
    } catch (error) {
      console.error('Error with OpenAI:', error);
      
      // Fallback summary if OpenAI fails
      return {
        title: 'Private Credit Deals Summary',
        summary: dealContent.length > 500 
          ? dealContent.substring(0, 500) + '...' 
          : dealContent || 'No deals found for this date.'
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