import axios from 'axios';

export interface PerplexityResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  citations?: string[];
}

export interface NewsCategory {
  category: string;
  items: NewsItem[];
}

export interface NewsItem {
  title: string;
  summary: string;
  source: string;
  date: string;
  url?: string;
  category: string;
}

export class PerplexityService {
  private apiKey: string;
  private baseUrl = 'https://api.perplexity.ai/chat/completions';

  constructor() {
    const rawKey = process.env.PERPLEXITY_API_KEY || '';
    // Clean the API key more aggressively - remove all non-printable characters
    this.apiKey = rawKey.replace(/[^\x20-\x7E]/g, '').trim();
    if (!this.apiKey) {
      throw new Error('PERPLEXITY_API_KEY environment variable is required');
    }
    console.log(`Perplexity API key loaded: ${this.apiKey.substring(0, 8)}...`);
  }

  async searchPrivateCreditDeals(date: string, fundQuery?: string): Promise<string> {
    const categories = [
      'Fund Launches and Closings',
      'Company Investments and Financing',
      'Private Equity Deals',
      'Private Debt/Credit Transactions'
    ];
    let allContent = '';
    for (const category of categories) {
      let query = `Find private credit and private equity news published EXACTLY on ${date} in category: ${category}. Only include news with publication date ${date} - no other dates.`;
      if (fundQuery) {
        query = `${query} focusing on ${fundQuery} fund/company details`;
        }
      const categoryContent = await this.executeSearch(query, category);
      allContent += categoryContent + '\n\n';
        }
    return allContent.trim();
  }

  private async executeMultipleSearches(baseQuery: string, category: string, targetCount: number): Promise<string> {
    const searchVariations = this.generateSearchVariations(baseQuery, category);
    let allResults = '';
    let foundCount = 0;

    console.log(`🔍 Starting ${category} search with ${searchVariations.length} variations, target: ${targetCount} articles`);

    for (let i = 0; i < searchVariations.length && foundCount < targetCount; i++) {
      try {
        console.log(`🔍 Executing search variation ${i + 1}/${searchVariations.length} for ${category}`);
        const result = await this.executeSearch(searchVariations[i], category);
        console.log(`📄 Search ${i + 1} result length: ${result?.length || 0}`);
        
        if (result && result.trim().length > 100) {
          allResults += `\n${result}\n`;
          const articleCount = this.countArticles(result);
          foundCount += articleCount;
          console.log(`✅ Added ${articleCount} articles from search ${i + 1}, total found: ${foundCount}`);
        } else {
          console.log(`⚠️ Search ${i + 1} returned insufficient content`);
        }
        
        // Rate limiting between searches
        if (i < searchVariations.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      } catch (error) {
        console.error(`❌ Search variation ${i + 1} failed:`, error);
      }
    }

    console.log(`🏁 Completed ${category} search. Total results length: ${allResults.length}, Found ${foundCount} articles`);
    return allResults;
  }

  private generateSearchVariations(baseQuery: string, category: string): string[] {
    const variations = [baseQuery];
    
    if (category === 'Deal Activity') {
      variations.push(
        baseQuery.replace('private credit', 'direct lending'),
        baseQuery.replace('private credit', 'alternative credit'),
        baseQuery.replace('private credit', 'private debt')
      );
    } else if (category === 'Fund Raised') {
      variations.push(
        baseQuery.replace('fund', 'capital raise'),
        baseQuery.replace('fund', 'fundraising'),
        baseQuery.replace('private credit', 'credit fund')
      );
    }
    
    return variations;
  }

  private countArticles(content: string): number {
    // Estimate article count based on content structure
    const bulletPoints = (content.match(/•/g) || []).length;
    const numbered = (content.match(/\d+\./g) || []).length;
    return Math.max(bulletPoints, numbered, 1);
  }

  private buildDealActivityQuery(date: string): string {
    return `Find private credit and direct lending deal announcements from ${date}. Search for:

    TRANSACTION ANNOUNCEMENTS:
    - Private credit facilities and term loans
    - Direct lending transactions with specific amounts
    - Asset-based lending (ABL) deals
    - Unitranche financing announcements
    - Mezzanine financing deals
    - Equipment financing transactions
    - Real estate credit facilities
    - Acquisition financing deals
    - Refinancing transactions
    - Working capital facilities

    SPECIFIC DEAL DETAILS TO INCLUDE:
    - Company names (borrower and lender)
    - Deal amounts and terms
    - Industry sectors
    - Transaction purposes
    - Lead arrangers and participants
    - Pricing information if available

    SOURCES TO SEARCH:
    - Bloomberg Terminal announcements
    - Reuters deal reports
    - S&P LCD (Leveraged Commentary & Data)
    - Debtwire reports
    - Company press releases
    - SEC filings
    - Private Debt Investor news
    - Creditflux reports

    For each deal found, provide:
    1. Headline with company name and deal size
    2. Brief summary of transaction details
    3. Source publication and URL if available
    4. Date of announcement

    Focus on factual deal announcements with specific financial details.`;
  }

  private buildFundRaisedQuery(date: string): string {
    return `Find private credit fund launches, closings, and fundraising announcements from ${date}. Search for:

    FUND ACTIVITY:
    - New private credit fund launches
    - First closings and final closings
    - Fund size targets and actual raises
    - Oversubscribed funds and extensions
    - New fund strategies and mandates
    - BDC (Business Development Company) capital raises
    - CLO (Collateralized Loan Obligation) issuances
    - Interval fund launches
    - Evergreen fund structures

    FUND MANAGERS TO TRACK:
    - Apollo Global Management
    - Blackstone Credit & Insurance
    - KKR Credit
    - Ares Management
    - Oaktree Capital Management
    - Bain Capital Credit
    - Blue Owl Capital
    - Golub Capital
    - Monroe Capital
    - TPG Credit
    - HPS Investment Partners
    - Sixth Street Partners
    - Intermediate Capital Group (ICG)

    DETAILS TO INCLUDE:
    - Fund name and manager
    - Target size vs. actual raise
    - Investment strategy focus
    - Geographic mandate
    - Investor base composition
    - Key terms and fees

    SOURCES:
    - Private Equity International (PEI)
    - Preqin fundraising data
    - Private Debt Investor
    - Institutional Investor reports
    - Manager press releases
    - Industry conference announcements

    Provide specific fundraising amounts, fund names, and manager details with source links.`;
  }

  private buildMarketNewsQuery(date: string): string {
    return `Find private credit market news, trends, and regulatory updates from ${date}. Search for:

    MARKET DEVELOPMENTS:
    - Private credit market conditions and outlook
    - Interest rate impacts on direct lending
    - Credit spread movements and pricing trends
    - Default rates and portfolio performance
    - Dry powder levels and deployment rates
    - Competition and market dynamics
    - Regulatory changes affecting private credit
    - Bank lending vs. private credit trends

    INDUSTRY ANALYSIS:
    - Market size and growth projections
    - Sector allocation trends
    - Geographic expansion news
    - Technology adoption in private credit
    - ESG integration developments
    - Risk management updates
    - Performance benchmarking reports

    INSTITUTIONAL ACTIVITY:
    - Insurance company allocations
    - Pension fund mandates
    - Endowment investment decisions
    - Sovereign wealth fund activity
    - Family office trends
    - Consultant recommendations

    SOURCES:
    - McKinsey Global Institute reports
    - Bain & Company studies
    - BCG alternative investment research
    - Moody's credit research
    - S&P Global ratings
    - Fitch Ratings reports
    - Federal Reserve studies
    - Bank for International Settlements data

    Focus on market-moving news with data and expert analysis.`;
  }

  private async executeSearch(query: string, category: string): Promise<string> {
    try {
      console.log(`🌐 Making Perplexity API call for ${category}`);
      console.log(`🌐 Query length: ${query.length}`);
      console.log(`🌐 API Key: ${this.apiKey.substring(0, 8)}...`);
      
      const response = await axios.post<PerplexityResponse>(
        this.baseUrl,
        {
          model: 'sonar-pro',
          messages: [
            {
              role: 'system',
              content: `You are a financial news analyst specializing in private credit and equity markets. For ${category}:

              CRITICAL REQUIREMENTS:
              1. Find REAL, SPECIFIC news on funds, companies, private equity deals, and private debt/credit transactions published EXACTLY on the requested date
              2. STRICT DATE VALIDATION: Only include articles with publication date matching the requested date - NO articles from other dates
              3. Include exact company names, fund details, deal amounts, and transaction structures
              4. MUST provide source URLs whenever possible - this is critical for verification
              5. Focus on factual announcements about funds and companies, not general commentary

              SEARCH STRATEGY:
              - MANDATORY: Only include news published on the exact date requested - NO exceptions
              - Reject any articles from yesterday, last week, 2024, or any other date
              - If an article mentions recent events but was published on a different date, EXCLUDE it
              - If no news exists for the exact date, respond with "No private credit news found for [exact date]"
              - Always verify publication date matches the requested date before including
              - Prioritize credible sources with company/fund specifics

              FORMAT EACH NEWS ITEM EXACTLY AS:
              • [HEADLINE] - [Company/Fund Name] [Deal/Announcement Details]
                Source: [Publication Name] | [DIRECT URL]
                Date: [Publication Date]
                Summary: [Brief explanation with key amounts and parties]

              REQUIRED URL FORMAT:
              - Must include working URLs like: https://www.bloomberg.com/news/articles/...
              - URLs from: Bloomberg, Reuters, Financial Times, WSJ, Private Equity International, etc.
              - If no URL available, write "Source: [Publication] | URL not available"

              Prioritize recent, verified announcements with specific financial details, confirmed dates, and WORKING SOURCE LINKS.`
            },
            {
              role: 'user',
              content: query
            }
          ],
          max_tokens: 4000,
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

      console.log(`🌐 API Response status: ${response.status}`);
      console.log(`🌐 API Response data:`, response.data);
      
      const result = response.data.choices[0]?.message?.content;
      console.log(`🌐 Extracted content length: ${result?.length || 0}`);
      console.log(`🌐 Content preview: ${result?.substring(0, 300) || 'No content'}...`);
      
      return result ? this.formatSearchResult(result, category) : `No ${category.toLowerCase()} found.`;
    } catch (error) {
      console.error(`❌ Error in ${category} search:`, error);
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
        console.error(`❌ API Error Response:`, axiosError.response?.data);
        console.error(`❌ API Error Status:`, axiosError.response?.status);
      }
      return `${category} search temporarily unavailable.`;
    }
  }

  private formatSearchResult(content: string, category: string): string {
    // Clean and format the content
    const lines = content.split('\n').filter(line => line.trim());
    const formattedLines = lines.map(line => {
      if (line.includes('•') || line.includes('-')) {
        return line;
      } else if (line.trim().length > 20) {
        return `• ${line.trim()}`;
      }
      return line;
    });

    return formattedLines.join('\n');
  }
} 