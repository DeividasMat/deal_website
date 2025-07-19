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

  async extractNewsArticles(newsContent: string, category: string, targetDate?: string): Promise<NewsAnalysis[]> {
    try {
      console.log(`🤖 OpenAI: Extracting articles from ${category} content (${newsContent.length} chars)`);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a financial news analyst specializing in private markets. Extract ONLY actual news articles about funds, companies, private equity, and private debt/credit from the provided content.

            CRITICAL REQUIREMENTS:
            - ONLY extract articles about REAL, SPECIFIC funds, companies, deals in private equity/debt
            - Focus on company profiles, fund details, investment activities
            - Include exact company names, fund sizes, deal amounts, participants
            - MUST extract working source URLs when available
            - Extract original source publication names
            - Create professional summaries highlighting private market aspects
            - DO NOT try to extract or validate publication dates from content

            WHAT TO EXTRACT:
            ✅ Private equity fund raises, investments, exits
            ✅ Private debt/credit facilities, direct lending
            ✅ Company acquisitions, growth financing in private markets
            ✅ Fund launches, closings, performance
            ✅ Credit ratings for private companies/funds

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

            IMPORTANT: DO NOT extract or validate dates from article content. The calling system will handle all date assignment.

            Return as JSON with "articles" array containing title, summary, category, source_url, and original_source. If no actual deals exist, return empty array.`
          },
          {
            role: 'user',
            content: `Extract clean news articles about actual deals/transactions. Generate SUPER CLEAR, SPECIFIC titles with company names and amounts. Assign proper categories. Deduplicate similar content. Extract working URLs and source publication names:

${newsContent}`
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
      
      // Filter out only obvious placeholder/empty content - NO date filtering
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
        
        return true; // Accept all non-placeholder articles
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
      /https?:\/\/[^\s\)"\]]+/g,
      // URLs after "Source:" patterns
      /Source:\s*[^|]*\|\s*(https?:\/\/[^\s\)"\]]+)/g,
      // URLs in parentheses
      /\(https?:\/\/[^\s\)"\]]+\)/g,
      // URLs in brackets
      /\[https?:\/\/[^\s\)"\]]+\]/g,
      // URLs after "URL:" patterns
      /URL:\s*(https?:\/\/[^\s\)"\]]+)/g
    ];
    
    // Find all URLs in content
    const foundUrls: string[] = [];
    
    for (const pattern of urlPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        foundUrls.push(...matches.map(match => {
          // Clean up the URL
          let url = match.replace(/^\(|\)$/g, ''); // Remove parentheses
          url = url.replace(/^\[|\]$/g, ''); // Remove brackets
          url = url.replace(/^["']|["']$/g, ''); // Remove quotes
          
          if (url.includes('|')) {
            url = url.split('|')[1].trim(); // Get URL after pipe
          }
          if (url.includes('URL:')) {
            url = url.replace(/^.*URL:\s*/, ''); // Remove URL: prefix
          }
          
          return url.replace(/[^\w:\/\-\.?&=_~#@!$'()*+,;]+$/, ''); // Remove trailing punctuation
        }));
      }
    }
    
    if (foundUrls.length > 0) {
      console.log(`🔗 Found ${foundUrls.length} potential URLs for "${articleTitle}"`);
      
      // Enhanced URL validation and filtering
      const validUrls = foundUrls.filter(url => this.isValidUrl(url));
      
      if (validUrls.length === 0) {
        console.log(`⚠️ No valid URLs found for "${articleTitle}"`);
        return undefined;
      }
      
      // Prioritize URLs from reputable financial sources
      const preferredSources = [
        'reuters.com',
        'bloomberg.com',
        'ft.com', 
        'wsj.com',
        'fortune.com',
        'businesswire.com',
        'prnewswire.com',
        'marketwatch.com',
        'cnbc.com',
        'financial-news.com',
        'privateequityinternational.com',
        'creditflux.com',
        'debtwire.com',
        'pitchbook.com',
        'preqin.com'
      ];
      
      // First, try to find URLs from preferred sources
      for (const source of preferredSources) {
        const preferredUrl = validUrls.find(url => url.toLowerCase().includes(source));
        if (preferredUrl) {
          console.log(`🔗 Selected preferred source URL: ${preferredUrl}`);
          return preferredUrl;
        }
      }
      
      // If no preferred source found, return the first valid URL
      const selectedUrl = validUrls[0];
      console.log(`🔗 Selected URL for "${articleTitle}": ${selectedUrl}`);
      return selectedUrl;
    }
    
    return undefined;
  }

  private isValidUrl(url: string): boolean {
    try {
      // Basic URL format validation
      if (!url || typeof url !== 'string') {
        return false;
      }
      
      // Must start with http or https
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return false;
      }
      
      // Must have a domain
      if (!url.includes('.')) {
        return false;
      }
      
      // Check for common invalid patterns
      const invalidPatterns = [
        /^https?:\/\/\s*$/,  // Just protocol
        /^https?:\/\/\.$/, // Just protocol and dot
        /^https?:\/\/localhost/, // Localhost URLs
        /^https?:\/\/127\.0\.0\.1/, // Local IP
        /^https?:\/\/0\.0\.0\.0/, // Invalid IP
        /\s/, // Contains whitespace
        /[<>"]/, // Contains HTML characters
        /^https?:\/\/[^\/]*$/, // No path and very short domain
      ];
      
      for (const pattern of invalidPatterns) {
        if (pattern.test(url)) {
          console.log(`❌ Invalid URL pattern detected: ${url}`);
          return false;
        }
      }
      
      // Test if URL can be parsed
      const parsedUrl = new URL(url);
      
      // Domain should have at least one dot and reasonable length
      if (parsedUrl.hostname.length < 4 || !parsedUrl.hostname.includes('.')) {
        console.log(`❌ Invalid hostname: ${parsedUrl.hostname}`);
        return false;
      }
      
      // URL should not be too long (likely corrupted)
      if (url.length > 2000) {
        console.log(`❌ URL too long: ${url.length} characters`);
        return false;
      }
      
      console.log(`✅ Valid URL: ${url}`);
      return true;
      
    } catch (error) {
      console.log(`❌ URL validation failed for: ${url} - ${error}`);
      return false;
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

  async generateCombinedReport(sources: string[]): Promise<string> {
    const combinedContent = sources.join('\n\n');
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Combine these search results into one comprehensive, informative report on the fund/company. Structure as: Overview, Key Details, Recent Activities, Sources.' },
        { role: 'user', content: combinedContent }
      ],
    });
    return response.choices[0].message.content || 'No report generated';
  }

  async enhanceArticle(deal: any): Promise<{ title: string; summary: string }> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a financial news editor specializing in private credit and private equity. Your task is to enhance article titles and summaries to make them more engaging and informative.

CRITICAL REQUIREMENTS:
1. TITLE: Create a compelling, informative headline that captures the key deal details
2. SUMMARY: Write EXACTLY 2 sentences that are informative, engaging, and capture the most important details
3. Focus on: deal amounts, company names, strategic significance, market impact
4. Use active voice and compelling language
5. Include specific financial figures when available
6. Make it newsworthy and interesting for finance professionals

STYLE:
- Professional but engaging tone
- Specific numbers and details
- Clear value proposition
- Market context when relevant`
          },
          {
            role: 'user',
            content: `Enhance this private credit/equity article:

ORIGINAL TITLE: ${deal.title}

ORIGINAL SUMMARY: ${deal.summary}

ORIGINAL CONTENT: ${deal.content.substring(0, 1000)}...

Please provide:
1. Enhanced Title: [improved title]
2. Enhanced Summary: [exactly 2 informative sentences]`
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      const content = response.choices[0].message.content || '';
      
      // Parse the response to extract title and summary
      const titleMatch = content.match(/Enhanced Title:\s*(.+?)(?:\n|$)/i);
      const summaryMatch = content.match(/Enhanced Summary:\s*(.+)/i);
      
      if (titleMatch && summaryMatch) {
        return {
          title: titleMatch[1].trim().replace(/^\[|\]$/g, ''),
          summary: summaryMatch[1].trim().replace(/^\[|\]$/g, '')
        };
      }
      
      // Fallback: try to extract from the response differently
      const lines = content.split('\n').filter(line => line.trim());
      let title = '';
      let summary = '';
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes('title') && i + 1 < lines.length) {
          title = lines[i + 1].replace(/^\d+\.\s*/, '').trim();
        }
        if (lines[i].toLowerCase().includes('summary') && i + 1 < lines.length) {
          // Get the next 1-2 lines for summary
          summary = lines.slice(i + 1, i + 3).join(' ').replace(/^\d+\.\s*/, '').trim();
          break;
        }
      }
      
      if (title && summary) {
        return { title, summary };
      }
      
      // Final fallback
      throw new Error('Could not parse enhanced content');
      
    } catch (error) {
      console.error('Error enhancing article:', error);
      throw error;
    }
  }

  async detectSemanticDuplicate(article1: any, article2: any): Promise<boolean> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a financial news analyst. Determine if two articles are covering the SAME deal, transaction, or financial event, even if they're from different sources or worded differently.

CRITICAL ANALYSIS CRITERIA:
- Are they about the SAME company/fund/deal?
- Are they reporting the SAME transaction or event?
- Do they have the SAME key financial details (amounts, dates, parties)?
- Even if sources differ, are they covering the SAME underlying story?

RESPOND WITH: "DUPLICATE" or "DIFFERENT"

Examples of DUPLICATES:
- Same company raising same amount from different sources
- Same merger/acquisition reported by different outlets
- Same credit facility/loan with same amount and company

Examples of DIFFERENT:
- Different companies even in same industry
- Different transaction amounts or dates
- Different types of deals (funding vs acquisition)
- Same company but different transactions`
          },
          {
            role: 'user',
            content: `ARTICLE 1:
Title: ${article1.title}
Summary: ${article1.summary}
Source: ${article1.source}
Date: ${article1.date}

ARTICLE 2:
Title: ${article2.title}
Summary: ${article2.summary}
Source: ${article2.source}
Date: ${article2.date}

Are these covering the SAME deal/transaction?`
          }
        ],
        max_tokens: 50,
        temperature: 0.1
      });

      const result = response.choices[0].message.content || '';
      return result.toLowerCase().includes('duplicate');
      
    } catch (error) {
      console.error('Error detecting semantic duplicate:', error);
      // Default to false if there's an error
      return false;
    }
  }

  async extractDateFromContent(title: string, summary: string, content: string): Promise<string | null> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a date extraction specialist. Extract the EXACT publication date from news content.

CRITICAL REQUIREMENTS:
- Extract ONLY the actual publication date of the article
- Return date in YYYY-MM-DD format
- If multiple dates mentioned, choose the publication date
- If no clear publication date found, return "UNKNOWN"
- Do NOT guess or approximate dates
- Look for phrases like "announced today", "reported yesterday", "published on", etc.

COMMON DATE PATTERNS:
- "July 14, 2025" → 2025-07-14
- "14 July 2025" → 2025-07-14
- "2025-07-14" → 2025-07-14
- "July 14th, 2025" → 2025-07-14

Return ONLY the date in YYYY-MM-DD format or "UNKNOWN".`
          },
          {
            role: 'user',
            content: `Extract the publication date from this article:

TITLE: ${title}

SUMMARY: ${summary}

CONTENT: ${content ? content.substring(0, 1000) : 'No content available'}...

Return ONLY the date in YYYY-MM-DD format or "UNKNOWN".`
          }
        ],
        max_tokens: 50,
        temperature: 0.1
      });

      const result = response.choices[0].message.content?.trim();
      
      if (result === 'UNKNOWN') {
        return null;
      }
      
      // Validate the date format
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      if (result && datePattern.test(result)) {
        const date = new Date(result);
        if (!isNaN(date.getTime())) {
          return result;
        }
      }
      
      return null;
      
    } catch (error) {
      console.log(`⚠️ Error extracting date from content: ${error}`);
      return null;
    }
  }
} 