import OpenAI from 'openai';

export interface NewsAnalysis {
  title: string;
  summary: string;
  category: string;
  source_url?: string;
  original_source?: string; // e.g., "Bloomberg", "Reuters"
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
            - MUST extract working source URLs when available (look for https:// links in content)
            - Extract original source publication names (Bloomberg, Reuters, etc.)
            - Create professional, well-structured summaries for finance professionals
            - Generate CLEAR, SPECIFIC titles that immediately explain what happened

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

            TITLE REQUIREMENTS (CRITICAL):
            - Be SUPER SPECIFIC: Include company name + exact action + amount
            - Examples of GOOD titles:
              ✅ "Apollo Provides $500M Credit Facility to TechCorp"
              ✅ "Blackstone Raises $2.1B for European Direct Lending Fund"
              ✅ "KKR Closes $800M Acquisition Financing for Manufacturing Deal"
              ✅ "Ares Issues $1.5B CLO for Infrastructure Lending"
              ✅ "Fitch Downgrades RetailCorp to BB- on Liquidity Concerns"
            - Examples of BAD titles:
              ❌ "Credit Facility Announced"
              ❌ "Fund Raising News"
              ❌ "Market Activity Update"
              ❌ "Deal Activity"

            CATEGORY ASSIGNMENT (CRITICAL):
            Assign ONE specific category based on content:
            - "Credit Facility" - for loans, credit lines, refinancing
            - "Fund Raising" - for fund launches, closings, capital raises
            - "M&A Financing" - for acquisition financing, LBO deals
            - "CLO/Securitization" - for CLO issuances, securitizations
            - "Credit Rating" - for rating actions, upgrades, downgrades
            - "Real Estate Credit" - for property financing deals
            - "Infrastructure Credit" - for infrastructure, energy deals
            - "Special Situations" - for distressed, restructuring deals

            SUMMARY STRUCTURE REQUIREMENTS:
            - **Sentence 1**: **WHO** (company/fund) did **WHAT** (transaction type) for **HOW MUCH** (amount)
            - **Sentence 2**: **Key transaction details** (structure, terms, participants, purpose)
            - **Sentence 3** (optional): **Strategic significance** or **market context** (why this matters)
            
            FORMATTING REQUIREMENTS:
            - Bold the following elements: **company names**, **dollar amounts**, **deal types**, **key metrics**
            - Use precise, Bloomberg-style financial language
            - Extract actual URLs (https://...) when mentioned in content
            - Extract original source publication names

            PERFECT EXAMPLES:
            {
              "title": "Apollo Provides $500M Credit Facility to TechCorp",
              "summary": "**Apollo Global Management** provided a **$500M credit facility** to **TechCorp** to finance its acquisition of three software companies in the healthcare sector. The facility includes a **$300M revolving credit line** and **$200M term loan** with **5-year maturity** and pricing at **SOFR + 350 basis points**. This transaction demonstrates Apollo's continued focus on technology sector growth financing amid increased competition for quality middle-market assets.",
              "category": "Credit Facility",
              "source_url": "https://www.bloomberg.com/news/articles/...",
              "original_source": "Bloomberg Terminal"
            }

            SOURCE EXTRACTION:
            - Look for patterns like "Source: [Publication] | https://..." 
            - Extract publication names: Bloomberg, Reuters, Financial Times, WSJ, Private Equity International, etc.
            - Only include working URLs, skip "URL not available"
            - Set original_source to the publication name (e.g., "Bloomberg Terminal", "Reuters")

            DEDUPLICATION:
            - If multiple articles are about the same deal/company, merge them into ONE comprehensive article
            - Use the most detailed information available
            - Keep the best source URL

            Return as JSON with "articles" array containing title, summary, category, source_url, and original_source. If no actual deals exist, return empty array.`
          },
          {
            role: 'user',
            content: `Extract clean news articles about actual deals/transactions. Generate SUPER CLEAR, SPECIFIC titles with company names and amounts. Assign proper categories. Deduplicate similar content. Extract working URLs and source publication names:\n\n${newsContent}`
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
          title.includes('deal activity') ||
          title.includes('market activity') ||
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
      
      // Enhanced deduplication - group by similar titles and merge
      const deduplicatedArticles = this.deduplicateArticles(filteredArticles);
      
      const processedArticles = deduplicatedArticles.map((article: any) => {
        // Ensure summary is 2-3 well-structured sentences with bold formatting
        let summary = article.summary || 'No summary available';
        const sentences = summary.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
        
        if (sentences.length === 1) {
          summary = sentences[0].trim() + '.';
        } else if (sentences.length === 2) {
          summary = sentences.slice(0, 2).join('. ').trim() + '.';
        } else if (sentences.length >= 3) {
          summary = sentences.slice(0, 3).join('. ').trim() + '.';
        }
        
        // Ensure minimum quality and bold formatting
        if (summary.length < 50) {
          summary = '**Limited details available** for this transaction. **Please refer to the original source** for more information. This appears to be a preliminary announcement.';
        }
        
        // Validate that there's some bold formatting for key elements
        if (!summary.includes('**')) {
          console.log(`⚠️ Adding basic bold formatting to: "${article.title}"`);
          summary = summary
            .replace(/(\$[\d,]+[MBK]?)/g, '**$1**')
            .replace(/(credit facility|term loan|financing|acquisition|fund|management|raised|closed|issued)/gi, '**$&**');
        }
        
        // Enhanced URL extraction from the original content
        let extractedUrl = article.source_url;
        if (!extractedUrl) {
          extractedUrl = this.extractUrlFromContent(newsContent, article.title);
        }
        
        // Ensure proper category assignment
        let finalCategory = article.category || 'Market News';
        if (finalCategory === 'Deal Activity') {
          finalCategory = this.inferCategoryFromContent(article.title, summary);
        }
        
        return {
          title: article.title?.substring(0, 80) || 'News Update', // Longer titles for clarity
          summary: summary,
          category: finalCategory,
          source_url: extractedUrl,
          original_source: article.original_source || 'Financial News'
        };
      });

      console.log(`🤖 Processed ${processedArticles.length} clean, deduplicated articles with enhanced formatting and source attribution`);
      return processedArticles;
      
    } catch (error) {
      console.error(`❌ Error extracting news articles from ${category}:`, error);
      return this.createFallbackArticles(newsContent, category);
    }
  }

  private deduplicateArticles(articles: any[]): any[] {
    const deduplicatedMap = new Map<string, any>();
    
    for (const article of articles) {
      // Create a key based on company name and deal type
      const titleWords = article.title.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((word: string) => word.length > 3);
      
      const companyName = titleWords.find((word: string) => 
        word.charAt(0).toUpperCase() === word.charAt(0) && word.length > 3
      ) || titleWords[0];
      
      const dealType = titleWords.find((word: string) => 
        ['credit', 'facility', 'loan', 'fund', 'raise', 'acquisition', 'financing'].includes(word)
      ) || '';
      
      const key = `${companyName}-${dealType}`;
      
      if (!deduplicatedMap.has(key)) {
        deduplicatedMap.set(key, article);
      } else {
        // Merge with existing article if this one has more details
        const existing = deduplicatedMap.get(key);
        if (article.summary.length > existing.summary.length || 
            (article.source_url && !existing.source_url)) {
          deduplicatedMap.set(key, article);
        }
      }
    }
    
    const result = Array.from(deduplicatedMap.values());
    console.log(`🔧 Deduplicated ${articles.length} → ${result.length} articles`);
    return result;
  }

  private inferCategoryFromContent(title: string, summary: string): string {
    const text = (title + ' ' + summary).toLowerCase();
    
    if (text.includes('credit facility') || text.includes('term loan') || text.includes('revolving') || text.includes('refinanc')) {
      return 'Credit Facility';
    } else if (text.includes('fund') && (text.includes('raise') || text.includes('launch') || text.includes('close'))) {
      return 'Fund Raising';
    } else if (text.includes('acquisition') || text.includes('buyout') || text.includes('lbo')) {
      return 'M&A Financing';
    } else if (text.includes('clo') || text.includes('securitization') || text.includes('asset-backed')) {
      return 'CLO/Securitization';
    } else if (text.includes('rating') || text.includes('upgrade') || text.includes('downgrade') || text.includes('fitch') || text.includes('moody')) {
      return 'Credit Rating';
    } else if (text.includes('real estate') || text.includes('property') || text.includes('reit')) {
      return 'Real Estate Credit';
    } else if (text.includes('infrastructure') || text.includes('energy') || text.includes('utilities')) {
      return 'Infrastructure Credit';
    } else if (text.includes('distressed') || text.includes('restructuring') || text.includes('bankruptcy')) {
      return 'Special Situations';
    }
    
    return 'Market News';
  }

  private extractUrlFromContent(content: string, articleTitle: string): string | undefined {
    // Look for URLs in the content that might be associated with this article
    const urlPatterns = [
      // Standard https URLs
      /https?:\/\/[^\s\)]+/g,
      // URLs after "Source:" patterns
      /Source:\s*[^|]*\|\s*(https?:\/\/[^\s\)]+)/g,
      // URLs in parentheses
      /\(https?:\/\/[^\s\)]+\)/g
    ];
    
    // Find all URLs in content
    const foundUrls: string[] = [];
    
    for (const pattern of urlPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        foundUrls.push(...matches.map(match => {
          // Clean up the URL
          let url = match.replace(/^\(|\)$/g, ''); // Remove parentheses
          if (url.includes('|')) {
            url = url.split('|')[1].trim(); // Get URL after pipe
          }
          return url.replace(/[^\w:\/\-\.?&=]+$/, ''); // Remove trailing punctuation
        }));
      }
    }
    
    if (foundUrls.length > 0) {
      // Prefer URLs from reputable financial sources
      const preferredSources = [
        'bloomberg.com',
        'reuters.com',
        'ft.com',
        'wsj.com',
        'financial-news.com',
        'privateequityinternational.com',
        'creditflux.com',
        'debtwire.com'
      ];
      
      for (const source of preferredSources) {
        const preferredUrl = foundUrls.find(url => url.includes(source));
        if (preferredUrl) {
          console.log(`🔗 Found preferred URL for "${articleTitle}": ${preferredUrl}`);
          return preferredUrl;
        }
      }
      
      // Return first valid URL if no preferred source found
      const firstUrl = foundUrls[0];
      console.log(`🔗 Found URL for "${articleTitle}": ${firstUrl}`);
      return firstUrl;
    }
    
    return undefined;
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
            source_url: undefined,
            original_source: 'Financial News'
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
            content: `You are a financial news analyst. Create a clean, well-structured summary of the provided content.

            REQUIREMENTS:
            - Focus ONLY on actual deals, transactions, and announcements
            - Ignore any "no news found" disclaimers or verbose explanations
            - Create a professional, blog-style summary with **bold formatting**
            - Include specific company names and deal amounts when available
            - Extract source publication names when mentioned
            - Keep it informative and readable

            SUMMARY STRUCTURE:
            - **Sentence 1**: **WHO** did **WHAT** for **HOW MUCH**
            - **Sentence 2**: **Key details** (structure, terms, significance)
            - **Sentence 3** (optional): **Market context** or implications

            FORMAT:
            - Title: Simple, direct headline (max 60 characters)
            - Summary: 2-3 structured sentences with **bold formatting** for key elements
            - Avoid technical jargon and disclaimers
            - Extract source publication if mentioned (Bloomberg, Reuters, etc.)

            If the content contains no actual deals, create a brief, neutral summary without disclaimers.`
          },
          {
            role: 'user',
            content: `Create a well-structured summary of this financial content, focusing only on actual deals with **bold formatting** for key elements:\n\n${dealContent}`
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
        source_url: parsed.source_url || undefined,
        original_source: parsed.original_source || 'Financial News'
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
        source_url: undefined,
        original_source: 'Financial News'
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