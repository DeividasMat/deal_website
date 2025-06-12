import axios from 'axios';

export interface PerplexityResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class PerplexityService {
  private apiKey: string;
  private baseUrl = 'https://api.perplexity.ai/chat/completions';

  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('PERPLEXITY_API_KEY environment variable is required');
    }
  }

  async searchPrivateCreditDeals(date: string): Promise<string> {
    const yesterday = new Date(date);
    const formattedDate = yesterday.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const query = `Search for private credit deal announcements and private equity transactions that were announced on ${formattedDate}. 
    Include information about:
    - New private credit funds launched
    - Major private credit transactions or investments
    - Private credit firm announcements
    - Fundraising announcements from private credit managers
    - Partnership announcements in private credit
    - Acquisition announcements involving private credit firms
    
    Please provide specific details including company names, deal sizes, and sources where available.`;

    try {
      const response = await axios.post<PerplexityResponse>(
        this.baseUrl,
        {
          model: 'llama-3.1-sonar-large-128k-online',
          messages: [
            {
              role: 'system',
              content: 'You are a financial news analyst specializing in private credit and private equity markets. Provide accurate, detailed information about deals and announcements.'
            },
            {
              role: 'user',
              content: query
            }
          ],
          max_tokens: 2000,
          temperature: 0.2,
          return_citations: true,
          return_images: false
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.choices[0]?.message?.content || 'No deals found for this date.';
    } catch (error) {
      console.error('Error searching with Perplexity:', error);
      throw new Error('Failed to search for private credit deals');
    }
  }
} 