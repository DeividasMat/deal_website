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
    const targetDate = new Date(date);
    const formattedDate = targetDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Multiple search strategies to maximize deal discovery
    const searchQueries = [
      // Primary comprehensive search
      `Find private credit and direct lending deal announcements from ${formattedDate}. Search financial news sources like PEI News, Preqin, Private Debt Investor, Bloomberg, Reuters, and company press releases for:
      - New private credit fund launches and first/final closings
      - Direct lending transactions and refinancing deals
      - Private credit acquisitions and strategic partnerships
      - Fundraising announcements from asset managers
      - Private debt investments and portfolio company financing
      - Credit facility announcements and term loan signings
      Include company names, deal amounts, sectors, and sources.`,

      // Secondary focused search
      `Search for "${formattedDate}" private credit news including:
      - "private credit" OR "direct lending" OR "private debt" funding announcements
      - Asset manager fundraising and portfolio investments
      - Middle market lending and acquisition financing
      - Private equity sponsor-backed deals with credit components
      - Alternative credit and specialty finance transactions
      Focus on institutional announcements and press releases.`,

      // Third search for broader context
      `Find financial market news from ${formattedDate} related to:
      - Private capital markets and alternative lending
      - Non-bank lending and credit investment announcements  
      - Institutional credit facility signings
      - Private fund portfolio company transactions
      - Asset-based lending and structured credit deals
      Search major financial publications and industry sources.`
    ];

    let allResults = '';

    try {
      // Execute multiple searches in sequence for comprehensive coverage
      for (let i = 0; i < searchQueries.length; i++) {
        try {
          console.log(`Executing search strategy ${i + 1}/3 for ${date}...`);
          
          const response = await axios.post<PerplexityResponse>(
            this.baseUrl,
            {
              model: 'llama-3.1-sonar-large-128k-online',
              messages: [
                {
                  role: 'system',
                  content: `You are a financial news analyst specializing in private credit markets. Search for and report on actual deal announcements, fundraising news, and transactions. Always include:
                  1. Company/fund names
                  2. Deal amounts (if disclosed)
                  3. Transaction type
                  4. Industry/sector
                  5. Source publication
                  6. Date of announcement
                  
                  Focus on factual announcements from credible financial news sources.`
                },
                {
                  role: 'user',
                  content: searchQueries[i]
                }
              ],
              max_tokens: 1500,
              temperature: 0.1,
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

          const searchResult = response.data.choices[0]?.message?.content;
          if (searchResult && searchResult.trim().length > 100) {
            allResults += `\n\n=== Search Strategy ${i + 1} Results ===\n${searchResult}`;
          }

          // Add delay between requests to respect rate limits
          if (i < searchQueries.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (searchError) {
          console.error(`Search strategy ${i + 1} failed:`, searchError);
          // Continue with next search strategy
        }
      }

      if (!allResults || allResults.trim().length < 200) {
        // Fallback search with broader terms
        console.log('Executing fallback search...');
        return await this.executeSearch(`Financial news and deal announcements from ${formattedDate} including private markets, credit facilities, fund launches, acquisitions, and investment transactions. Include any alternative lending, direct lending, or private capital market activities.`);
      }

      return allResults;
    } catch (error) {
      console.error('Error in comprehensive search:', error);
      throw new Error('Failed to search for private credit deals');
    }
  }

  private async executeSearch(query: string): Promise<string> {
    try {
      const response = await axios.post<PerplexityResponse>(
        this.baseUrl,
        {
          model: 'llama-3.1-sonar-large-128k-online',
          messages: [
            {
              role: 'system',
              content: 'You are a financial news analyst. Find and report actual news announcements with specific details including company names, amounts, and sources.'
            },
            {
              role: 'user',
              content: query
            }
          ],
          max_tokens: 1500,
          temperature: 0.1,
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
      console.error('Error in fallback search:', error);
      return 'Search temporarily unavailable.';
    }
  }
} 