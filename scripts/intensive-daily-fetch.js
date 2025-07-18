require('dotenv').config();
const { format, addDays, subDays } = require('date-fns');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const { OpenAI } = require('openai');

// Initialize services
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const perplexityKey = process.env.PERPLEXITY_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

console.log('🔧 Environment check:');
console.log(`  Supabase URL: ${supabaseUrl ? '✅ Found' : '❌ Missing'}`);
console.log(`  Supabase Key: ${supabaseKey ? '✅ Found' : '❌ Missing'}`);
console.log(`  Perplexity Key: ${perplexityKey ? '✅ Found' : '❌ Missing'}`);
console.log(`  OpenAI Key: ${openaiKey ? '✅ Found' : '❌ Missing'}`);

if (!supabaseUrl || !supabaseKey || !perplexityKey || !openaiKey) {
  console.error('❌ Missing required environment variables');
  console.error('Make sure you have .env file with:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL=...');
  console.error('  NEXT_PUBLIC_SUPABASE_ANON_KEY=...');
  console.error('  PERPLEXITY_API_KEY=...');
  console.error('  OPENAI_API_KEY=...');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: openaiKey });

class IntensiveDailyFetcher {
  constructor() {
    this.processedArticles = new Set();
    this.totalArticlesAdded = 0;
    this.duplicatesSkipped = 0;
  }

  async fetchArticlesForDate(date) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🚀 INTENSIVE FETCH FOR ${date}`);
    console.log(`${'='.repeat(80)}`);
    
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayName = format(date, 'EEEE');
    
    console.log(`📅 Target Date: ${dateStr} (${dayName})`);
    
    // Get existing articles for this date to avoid duplicates
    const existingArticles = await this.getExistingArticles(dateStr);
    console.log(`📊 Found ${existingArticles.length} existing articles for ${dateStr}`);
    
    // Search strategies with different approaches
    const searchStrategies = [
      {
        name: 'Private Credit Deals',
        query: `Find private credit and direct lending deals, transactions, and facilities announced on ${dateStr}. Include: company names, deal amounts, lenders, borrowers, terms, and purposes. Focus on specific transactions with dollar amounts.`,
        category: 'Credit Facility'
      },
      {
        name: 'Fund Launches & Closings',
        query: `Find private credit and private equity fund launches, closings, and capital raises announced on ${dateStr}. Include: fund names, managers, target amounts, actual raises, investor types, and strategies.`,
        category: 'Fund Raising'
      },
      {
        name: 'M&A Financing',
        query: `Find acquisition financing, LBO deals, and merger transactions in private markets announced on ${dateStr}. Include: target companies, acquirers, financing sources, deal values, and structures.`,
        category: 'M&A Financing'
      },
      {
        name: 'Credit Ratings',
        query: `Find credit rating actions, upgrades, downgrades, and new ratings for private companies, funds, and credit facilities announced on ${dateStr}. Include: rating agencies, companies, old/new ratings, and reasons.`,
        category: 'Credit Rating'
      },
      {
        name: 'CLO & Securitization',
        query: `Find CLO issuances, securitization deals, and structured credit transactions announced on ${dateStr}. Include: issuers, deal sizes, ratings, managers, and structures.`,
        category: 'CLO/Securitization'
      }
    ];
    
    let dayArticles = [];
    let searchAttempts = 0;
    
    // Try each search strategy
    for (const strategy of searchStrategies) {
      console.log(`\n🎯 Strategy: ${strategy.name}`);
      console.log(`📝 Query: ${strategy.query.substring(0, 100)}...`);
      
      try {
        searchAttempts++;
        const articles = await this.searchWithPerplexity(strategy.query, dateStr, strategy.category);
        
        if (articles && articles.length > 0) {
          console.log(`✅ Found ${articles.length} articles for ${strategy.name}`);
          dayArticles = dayArticles.concat(articles);
        } else {
          console.log(`⚠️ No articles found for ${strategy.name}`);
        }
        
        // Rate limit delay
        await this.delay(2000);
        
      } catch (error) {
        console.error(`❌ Error in ${strategy.name}: ${error.message}`);
      }
    }
    
    // If no articles found, try broader searches
    if (dayArticles.length === 0) {
      console.log(`\n🔍 No articles found with specific date. Trying broader searches...`);
      
      const broaderStrategies = [
        {
          name: 'Weekly Private Credit News',
          query: `Find private credit, direct lending, and private debt news from the week of ${dateStr}. Include any deals, fund activities, or market developments from that week.`,
          category: 'Market News'
        },
        {
          name: 'Private Equity Weekly',
          query: `Find private equity deals, fund activities, and market news from the week of ${dateStr}. Include acquisitions, exits, and fundraising activities.`,
          category: 'Market News'
        }
      ];
      
      for (const strategy of broaderStrategies) {
        console.log(`\n🌐 Broader Strategy: ${strategy.name}`);
        
        try {
          const articles = await this.searchWithPerplexity(strategy.query, dateStr, strategy.category);
          
          if (articles && articles.length > 0) {
            console.log(`✅ Found ${articles.length} articles with broader search`);
            dayArticles = dayArticles.concat(articles);
          }
          
          await this.delay(2000);
        } catch (error) {
          console.error(`❌ Error in broader search: ${error.message}`);
        }
      }
    }
    
    console.log(`\n📊 Total articles found: ${dayArticles.length}`);
    
    // Process and deduplicate articles
    const processedArticles = await this.processArticles(dayArticles, dateStr, existingArticles);
    
    // Save to database
    let savedCount = 0;
    for (const article of processedArticles) {
      try {
        await this.saveArticle(article);
        savedCount++;
        this.totalArticlesAdded++;
        console.log(`💾 Saved: "${article.title.substring(0, 60)}..."`);
      } catch (error) {
        console.error(`❌ Error saving article: ${error.message}`);
      }
    }
    
    console.log(`\n📈 Day Summary for ${dateStr}:`);
    console.log(`  🔍 Search attempts: ${searchAttempts}`);
    console.log(`  📰 Articles found: ${dayArticles.length}`);
    console.log(`  💾 Articles saved: ${savedCount}`);
    console.log(`  🚫 Duplicates skipped: ${dayArticles.length - savedCount}`);
    
    return savedCount;
  }

  async searchWithPerplexity(query, date, category) {
    console.log(`🌐 Searching with Perplexity...`);
    
    try {
      const response = await axios.post(
        'https://api.perplexity.ai/chat/completions',
        {
          model: 'sonar-pro',
          messages: [
            {
              role: 'system',
              content: `You are a financial news analyst. Find REAL, SPECIFIC private credit and private equity news. Requirements:
              
              1. Find actual deals, transactions, and fund activities
              2. Include company names, amounts, participants, and details
              3. Provide source URLs when possible
              4. Focus on factual announcements with financial details
              5. Prefer recent, credible sources
              
              Format each article as:
              • [HEADLINE] - [Company] [Amount] [Details]
                Source: [Publication] | [URL]
                Date: [Date]
                Summary: [Brief explanation]`
            },
            {
              role: 'user',
              content: query
            }
          ],
          max_tokens: 4000,
          temperature: 0.1,
          return_citations: true
        },
        {
          headers: {
            'Authorization': `Bearer ${perplexityKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const content = response.data.choices[0]?.message?.content;
      
      if (!content) {
        console.log(`⚠️ No content returned from Perplexity`);
        return [];
      }
      
      console.log(`📄 Perplexity response length: ${content.length}`);
      
      // Process with OpenAI
      const articles = await this.processWithOpenAI(content, date, category);
      return articles;
      
    } catch (error) {
      console.error(`❌ Perplexity API error: ${error.message}`);
      return [];
    }
  }

  async processWithOpenAI(content, date, category) {
    console.log(`🤖 Processing with OpenAI...`);
    
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a financial news analyst. Extract REAL, SPECIFIC private credit and private equity articles from the content.

            STRICT REQUIREMENTS:
            - Extract only actual deals, transactions, and fund activities
            - Include company names, fund names, amounts, and participants
            - Create professional, Bloomberg-style summaries
            - Assign appropriate categories
            - Extract source URLs when available
            - Focus on factual announcements with financial details
            
            CATEGORIES:
            - "Credit Facility" - loans, credit lines, refinancing
            - "Fund Raising" - fund launches, closings, capital raises
            - "M&A Financing" - acquisition financing, LBO deals
            - "CLO/Securitization" - CLO issuances, securitizations
            - "Credit Rating" - rating actions, upgrades, downgrades
            - "Market News" - general market developments
            
            TITLE FORMAT:
            Be specific: "Apollo Provides $500M Credit Facility to TechCorp"
            Not generic: "Credit Facility Announced"
            
            SUMMARY FORMAT:
            - **Bold** company names, amounts, and key terms
            - 2-3 sentences with key transaction details
            - Professional, factual tone
            
            Return JSON with "articles" array containing:
            - title (specific with company names and amounts)
            - summary (2-3 sentences with bold formatting)
            - category (from the list above)
            - source (publication name)
            - source_url (if available)
            - date (${date})
            
            If no real deals found, return empty array.`
          },
          {
            role: 'user',
            content: `Extract private credit/equity articles from this content. Target date: ${date}. Category: ${category}.\n\n${content}`
          }
        ],
        max_tokens: 4000,
        temperature: 0.1,
        response_format: { type: "json_object" }
      });
      
      const result = response.choices[0]?.message?.content;
      
      if (!result) {
        console.log(`⚠️ No content returned from OpenAI`);
        return [];
      }
      
      const parsed = JSON.parse(result);
      const articles = parsed.articles || [];
      
      console.log(`🤖 OpenAI extracted ${articles.length} articles`);
      
      return articles.filter(article => 
        article.title && 
        article.summary && 
        article.title.length > 10 && 
        article.summary.length > 20
      );
      
    } catch (error) {
      console.error(`❌ OpenAI processing error: ${error.message}`);
      return [];
    }
  }

  async processArticles(articles, date, existingArticles) {
    console.log(`🔄 Processing ${articles.length} articles for deduplication...`);
    
    const processed = [];
    const seen = new Set();
    
    // Create lookup set for existing articles
    const existingTitles = new Set(existingArticles.map(a => this.normalizeTitle(a.title)));
    
    for (const article of articles) {
      const normalizedTitle = this.normalizeTitle(article.title);
      
      // Check if we've already processed this title
      if (seen.has(normalizedTitle)) {
        console.log(`🚫 Duplicate within batch: "${article.title}"`);
        this.duplicatesSkipped++;
        continue;
      }
      
      // Check if it exists in database
      if (existingTitles.has(normalizedTitle)) {
        console.log(`🚫 Already exists in database: "${article.title}"`);
        this.duplicatesSkipped++;
        continue;
      }
      
      // Check if it's a valid article
      if (!this.isValidArticle(article)) {
        console.log(`🚫 Invalid article: "${article.title}"`);
        continue;
      }
      
      seen.add(normalizedTitle);
      processed.push({
        ...article,
        date: date
      });
    }
    
    console.log(`✅ Processed ${processed.length} unique articles`);
    return processed;
  }

  normalizeTitle(title) {
    return title.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  isValidArticle(article) {
    const title = article.title || '';
    const summary = article.summary || '';
    
    // Check minimum length
    if (title.length < 10 || summary.length < 20) {
      return false;
    }
    
    // Check for placeholder content
    const placeholderPhrases = [
      'no news found',
      'no articles found',
      'no specific news',
      'after a thorough review',
      'however, here are some',
      'key findings',
      'conclusion'
    ];
    
    const combined = (title + ' ' + summary).toLowerCase();
    return !placeholderPhrases.some(phrase => combined.includes(phrase));
  }

  async getExistingArticles(date) {
    try {
      const { data, error } = await supabase
        .from('deals')
        .select('title, summary')
        .eq('date', date);
      
      if (error) {
        console.error('❌ Error fetching existing articles:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('❌ Error in getExistingArticles:', error);
      return [];
    }
  }

  async saveArticle(article) {
    const { error } = await supabase
      .from('deals')
      .insert([{
        date: article.date,
        title: article.title,
        summary: article.summary,
        content: article.summary, // Use summary as content for now
        source: article.source || 'Financial News',
        source_url: article.source_url || null,
        category: article.category || 'Market News',
        upvotes: 0
      }]);
    
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async runIntensiveFetch() {
    console.log('🚀 Starting INTENSIVE DAILY FETCH...');
    console.log('📅 Fetching articles for last 2 weeks (July 1-15, 2025)');
    console.log('🔥 Using Perplexity + OpenAI directly with aggressive search');
    console.log('🚫 No duplicates allowed - comprehensive deduplication');
    
    const endDate = new Date('2025-07-15');
    const startDate = new Date('2025-07-01');
    
    let currentDate = startDate;
    let totalDays = 0;
    let successfulDays = 0;
    
    while (currentDate <= endDate) {
      totalDays++;
      
      try {
        const articlesAdded = await this.fetchArticlesForDate(currentDate);
        
        if (articlesAdded > 0) {
          successfulDays++;
        }
        
        console.log(`⏱️ Waiting 5 seconds before next day...`);
        await this.delay(5000);
        
      } catch (error) {
        console.error(`❌ Error processing ${format(currentDate, 'yyyy-MM-dd')}: ${error.message}`);
      }
      
      currentDate = addDays(currentDate, 1);
    }
    
    // Final summary
    console.log(`\n${'='.repeat(100)}`);
    console.log(`🎉 INTENSIVE FETCH COMPLETED!`);
    console.log(`${'='.repeat(100)}`);
    console.log(`📅 Days processed: ${totalDays}`);
    console.log(`✅ Successful days: ${successfulDays}`);
    console.log(`📰 Total articles added: ${this.totalArticlesAdded}`);
    console.log(`🚫 Duplicates skipped: ${this.duplicatesSkipped}`);
    console.log(`${'='.repeat(100)}`);
    
    // Get final count
    try {
      const { data, error } = await supabase
        .from('deals')
        .select('id', { count: 'exact' });
      
      if (!error) {
        console.log(`📊 Final database count: ${data.length} total articles`);
      }
    } catch (error) {
      console.error('❌ Error getting final count:', error);
    }
    
    console.log(`\n🔗 Check your website: https://privatecreditpulse.net`);
    console.log(`🎯 You should now have a comprehensive database of private credit/equity deals!`);
  }
}

// Run the intensive fetch
const fetcher = new IntensiveDailyFetcher();
fetcher.runIntensiveFetch().catch(console.error); 