require('dotenv').config();
const { format, addDays } = require('date-fns');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const { OpenAI } = require('openai');

// Use exact production configuration
const supabaseUrl = 'https://rjiffflsqvtzmbovpync.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const perplexityKey = process.env.PERPLEXITY_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

console.log('🔧 Production Database Writer Configuration:');
console.log(`  Production Supabase URL: ${supabaseUrl}`);
console.log(`  Supabase Key: ${supabaseKey ? '✅ Found' : '❌ Missing'}`);
console.log(`  Perplexity Key: ${perplexityKey ? '✅ Found' : '❌ Missing'}`);
console.log(`  OpenAI Key: ${openaiKey ? '✅ Found' : '❌ Missing'}`);

if (!supabaseKey || !perplexityKey || !openaiKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: openaiKey });

class ProductionDatabaseWriter {
  constructor() {
    this.totalArticlesAdded = 0;
    this.errors = [];
  }

  async verifyConnection() {
    console.log('🔍 Verifying production database connection...');
    
    try {
      const { data, error } = await supabase
        .from('deals')
        .select('id', { count: 'exact' });
      
      if (error) {
        console.error('❌ Database connection error:', error);
        return false;
      }
      
      console.log(`✅ Connected to production database with ${data.length} articles`);
      return true;
    } catch (error) {
      console.error('❌ Connection verification failed:', error);
      return false;
    }
  }

  async searchAndSaveArticles(date, maxArticles = 10) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📰 FETCHING FOR ${date}`);
    console.log(`${'='.repeat(60)}`);
    
    const searchQueries = [
      {
        name: 'Private Credit Deals',
        query: `Find private credit and direct lending deals announced on ${date}. Include: company names, deal amounts, lenders, purposes. Focus on specific transactions.`,
        category: 'Credit Facility'
      },
      {
        name: 'Fund Raises',
        query: `Find private credit and private equity fund launches, closings, and capital raises announced on ${date}. Include: fund names, managers, amounts.`,
        category: 'Fund Raising'
      },
      {
        name: 'M&A Financing',
        query: `Find acquisition financing, LBO deals, and merger transactions announced on ${date}. Include: target companies, acquirers, deal values.`,
        category: 'M&A Financing'
      }
    ];
    
    let dayArticles = [];
    
    for (const search of searchQueries) {
      console.log(`\n🎯 ${search.name}:`);
      
      try {
        const articles = await this.searchWithPerplexity(search.query, date, search.category);
        
        if (articles.length > 0) {
          console.log(`✅ Found ${articles.length} articles`);
          dayArticles = dayArticles.concat(articles);
        } else {
          console.log(`⚠️ No articles found`);
        }
        
        await this.delay(2000);
      } catch (error) {
        console.error(`❌ Error in ${search.name}:`, error.message);
        this.errors.push(`${search.name}: ${error.message}`);
      }
    }
    
    // Deduplicate and save
    const uniqueArticles = this.deduplicateArticles(dayArticles);
    console.log(`\n📊 Found ${dayArticles.length} articles, ${uniqueArticles.length} unique`);
    
    let savedCount = 0;
    for (const article of uniqueArticles.slice(0, maxArticles)) {
      try {
        const saved = await this.saveArticleToProduction(article);
        if (saved) {
          savedCount++;
          this.totalArticlesAdded++;
          console.log(`💾 Saved: "${article.title.substring(0, 50)}..."`);
        }
      } catch (error) {
        console.error(`❌ Error saving article:`, error.message);
        this.errors.push(`Save error: ${error.message}`);
      }
    }
    
    console.log(`📈 Day summary: ${savedCount} articles saved`);
    return savedCount;
  }

  async searchWithPerplexity(query, date, category) {
    try {
      const response = await axios.post(
        'https://api.perplexity.ai/chat/completions',
        {
          model: 'sonar-pro',
          messages: [
            {
              role: 'system',
              content: `Find REAL private credit and private equity news. Include company names, amounts, and details. Format as news items with sources.`
            },
            {
              role: 'user',
              content: query
            }
          ],
          max_tokens: 3000,
          temperature: 0.1
        },
        {
          headers: {
            'Authorization': `Bearer ${perplexityKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const content = response.data.choices[0]?.message?.content || '';
      
      if (!content || content.length < 100) {
        return [];
      }
      
      // Process with OpenAI
      const articles = await this.processWithOpenAI(content, date, category);
      return articles;
      
    } catch (error) {
      console.error(`❌ Perplexity API error:`, error.message);
      return [];
    }
  }

  async processWithOpenAI(content, date, category) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Extract REAL private credit/equity articles with company names and amounts. 
            
            Requirements:
            - Extract only actual deals with company names and amounts
            - Create specific titles: "Company Name Action $Amount for Purpose"
            - Professional 2-3 sentence summaries with **bold** formatting
            - Valid categories: Credit Facility, Fund Raising, M&A Financing, Credit Rating, CLO/Securitization
            - Extract source URLs when available
            
            Return JSON with "articles" array. If no real deals, return empty array.`
          },
          {
            role: 'user',
            content: `Extract articles from this content for ${date} in category ${category}:\n\n${content}`
          }
        ],
        max_tokens: 3000,
        temperature: 0.1,
        response_format: { type: "json_object" }
      });
      
      const result = response.choices[0]?.message?.content;
      
      if (!result) {
        return [];
      }
      
      const parsed = JSON.parse(result);
      const articles = parsed.articles || [];
      
      // Filter valid articles
      return articles.filter(article => 
        article.title && 
        article.summary && 
        article.title.length > 15 && 
        article.summary.length > 30 &&
        !article.title.toLowerCase().includes('no news found')
      );
      
    } catch (error) {
      console.error(`❌ OpenAI processing error:`, error.message);
      return [];
    }
  }

  deduplicateArticles(articles) {
    const seen = new Set();
    const unique = [];
    
    for (const article of articles) {
      const key = article.title.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(article);
      }
    }
    
    return unique;
  }

  async saveArticleToProduction(article) {
    try {
      const articleData = {
        date: article.date,
        title: article.title,
        summary: article.summary,
        content: article.summary,
        source: article.source || 'Financial News',
        source_url: article.source_url || null,
        category: article.category || 'Market News',
        upvotes: 0
      };
      
      const { data, error } = await supabase
        .from('deals')
        .insert([articleData])
        .select('id')
        .single();
      
      if (error) {
        console.error('❌ Database insert error:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('❌ Save error:', error);
      return false;
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async runProductionWriter() {
    console.log('🚀 Starting PRODUCTION DATABASE WRITER...');
    console.log('🎯 Writing directly to production database');
    
    // Verify connection first
    const connected = await this.verifyConnection();
    if (!connected) {
      console.error('❌ Cannot connect to production database');
      return;
    }
    
    // Get initial count
    const { data: initialData } = await supabase
      .from('deals')
      .select('id', { count: 'exact' });
    const initialCount = initialData?.length || 0;
    
    console.log(`📊 Starting with ${initialCount} articles`);
    
    // Process key dates
    const keyDates = [
      '2025-07-15',
      '2025-07-14',
      '2025-07-13',
      '2025-07-12',
      '2025-07-11',
      '2025-07-10',
      '2025-07-09',
      '2025-07-08',
      '2025-07-07'
    ];
    
    let totalSaved = 0;
    
    for (const date of keyDates) {
      const savedCount = await this.searchAndSaveArticles(date, 8);
      totalSaved += savedCount;
      
      console.log(`⏱️ Waiting 5 seconds...`);
      await this.delay(5000);
    }
    
    // Final verification
    const { data: finalData } = await supabase
      .from('deals')
      .select('id', { count: 'exact' });
    const finalCount = finalData?.length || 0;
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🎉 PRODUCTION DATABASE WRITER COMPLETED!`);
    console.log(`${'='.repeat(80)}`);
    console.log(`📊 Initial count: ${initialCount}`);
    console.log(`📊 Final count: ${finalCount}`);
    console.log(`📈 Articles added: ${finalCount - initialCount}`);
    console.log(`✅ Successful saves: ${totalSaved}`);
    
    if (this.errors.length > 0) {
      console.log(`⚠️ Errors encountered: ${this.errors.length}`);
      this.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    console.log(`\n🔗 Check your website: https://privatecreditpulse.net`);
    console.log(`🎯 Articles should now be visible on the production site!`);
  }
}

// Run the production writer
const writer = new ProductionDatabaseWriter();
writer.runProductionWriter().catch(console.error); 