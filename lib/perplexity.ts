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
    this.apiKey = (process.env.PERPLEXITY_API_KEY || '').trim();
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

    // Multiple comprehensive search strategies to find ALL types of private credit deals
    const searchQueries = [
      // Strategy 1: Core Private Credit Deals
      `Search for private credit deals and announcements from ${formattedDate}. Find news from Bloomberg, Reuters, Private Debt Investor, PEI News, Creditflux, and company press releases about:
      
      FUND ACTIVITY:
      - Private credit fund launches, first close, final close
      - Direct lending fund raises by Apollo, Blackstone, KKR, Ares, Oaktree, Bain Capital Credit
      - Middle market lending fund formations
      - Distressed debt fund launches
      
      TRANSACTIONS:
      - Private credit financing deals
      - Unitranche lending transactions  
      - Asset-based lending deals
      - Equipment financing announcements
      - Real estate credit transactions
      - Distressed loan acquisitions
      - Secondary market credit transactions
      
      Include specific company names, deal sizes, borrower names, and lender details.`,

      // Strategy 2: Alternative Credit & Specialty Finance
      `Find alternative lending and specialty finance deals from ${formattedDate}:
      
      ALTERNATIVE CREDIT:
      - Business development company (BDC) investments
      - Collateralized loan obligation (CLO) issuances
      - Private placement transactions
      - Mezzanine financing deals
      - Venture debt transactions
      - Specialty finance company announcements
      
      DISTRESSED & SPECIAL SITUATIONS:
      - Distressed debt investments
      - NPL (non-performing loan) acquisitions
      - Restructuring and turnaround financing
      - DIP (debtor-in-possession) financing
      - Rescue financing deals
      - Opportunistic credit investments
      
      CORPORATE CREDIT:
      - Term loan B signings
      - Leveraged buyout financing
      - Refinancing transactions
      - Credit facility amendments
      - Sponsor-backed deals`,

      // Strategy 3: Institutional & Market Activity  
      `Search for institutional credit market activity from ${formattedDate}:
      
      INSTITUTIONAL MOVES:
      - Insurance company private credit allocations
      - Pension fund direct lending investments
      - Endowment alternative credit commitments
      - Sovereign wealth fund private debt investments
      
      MARKET INFRASTRUCTURE:
      - Credit rating agency actions on private companies
      - Private credit platform launches
      - Technology solutions for private lending
      - Regulatory announcements affecting private credit
      
      PEOPLE & PARTNERSHIPS:
      - Senior hiring at private credit firms
      - Joint ventures in private lending
      - Strategic partnerships between lenders
      - New office openings for credit managers
      
      Search sources: Private Equity International, Preqin, S&P Global, Fitch, Moody's, LevFin Insights.`
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
        return await this.executeSearch(`Search for ANY financial deals and transactions from ${formattedDate} including:
        
        PRIVATE CREDIT: Direct lending, private debt, alternative credit, distressed loans, mezzanine financing, unitranche deals, asset-based lending, equipment financing, venture debt, BDC investments, CLO issuances
        
        COMPANIES: Apollo Global, Blackstone Credit, KKR Credit, Ares Management, Oaktree Capital, Bain Capital Credit, Blue Owl Capital, Golub Capital, Monroe Capital, TPG Credit, HPS Investment Partners
        
        TRANSACTION TYPES: Fund launches, portfolio investments, refinancing deals, LBO financing, term loan signings, credit facility agreements, NPL acquisitions, restructuring finance, DIP financing
        
        Include company names, deal amounts, borrower details, and any private market activity.`);
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