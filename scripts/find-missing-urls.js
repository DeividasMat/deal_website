const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Perplexity client (using OpenAI format)
const perplexity = new OpenAI({
  apiKey: process.env.PERPLEXITY_API_KEY,
  baseURL: 'https://api.perplexity.ai',
});

async function searchWithPerplexity(title, company, date) {
  console.log(`🔍 Searching for: "${title}"`);
  
  const searchQuery = `Find the original source URL for this financial news article: "${title}"`;
  const dateContext = date ? ` published around ${date}` : '';
  
  try {
    const response = await perplexity.chat.completions.create({
      model: 'llama-3.1-sonar-small-128k-online',
      messages: [
        {
          role: 'system',
          content: `You are a financial news researcher. Your job is to find the original source URL for financial news articles. 
          
          REQUIREMENTS:
          1. Search for the EXACT article title provided
          2. Look for reputable financial sources: Bloomberg, Reuters, Financial Times, Wall Street Journal, PR Newswire, GlobeNewswire, Business Wire, company press releases
          3. Return ONLY the direct URL to the article - no explanations
          4. If you can't find the exact article, return "NOT_FOUND"
          5. Prioritize official sources over aggregators
          
          Format your response as:
          URL: [direct_url_here]
          SOURCE: [publication_name]
          
          If not found, respond with:
          NOT_FOUND`
        },
        {
          role: 'user',
          content: `${searchQuery}${dateContext}`
        }
      ],
      temperature: 0.1,
      max_tokens: 200
    });

    const content = response.choices[0].message.content;
    console.log(`📄 Perplexity response: ${content.substring(0, 200)}...`);
    
    // Extract URL and source from response
    const urlMatch = content.match(/URL:\s*(https?:\/\/[^\s\n]+)/i);
    const sourceMatch = content.match(/SOURCE:\s*([^\n]+)/i);
    
    if (urlMatch && !content.includes('NOT_FOUND')) {
      return {
        url: urlMatch[1].trim(),
        source: sourceMatch ? sourceMatch[1].trim() : null,
        found: true
      };
    }
    
    return { url: null, source: null, found: false };
    
  } catch (error) {
    console.error(`❌ Perplexity search failed for "${title}":`, error.message);
    return { url: null, source: null, found: false };
  }
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function findMissingUrls(articles, updateDatabase = false) {
  console.log(`🔍 Searching for URLs for ${articles.length} articles...`);
  
  const results = [];
  let found = 0;
  let notFound = 0;
  
  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    console.log(`\n📰 [${i + 1}/${articles.length}] Processing: "${article.title.substring(0, 60)}..."`);
    console.log(`   Current source: ${article.source}`);
    console.log(`   Date: ${article.created_at}`);
    
    // Search for URL with Perplexity
    const searchResult = await searchWithPerplexity(
      article.title,
      extractCompanyFromTitle(article.title),
      article.created_at
    );
    
    if (searchResult.found) {
      console.log(`✅ Found URL: ${searchResult.url}`);
      console.log(`   Source: ${searchResult.source || 'Unknown'}`);
      
      results.push({
        ...article,
        newUrl: searchResult.url,
        newSource: searchResult.source || article.source,
        status: 'found'
      });
      found++;
      
      // Update database if requested
      if (updateDatabase) {
        try {
          const { error } = await supabase
            .from('deals')
            .update({
              source_url: searchResult.url,
              source: searchResult.source || article.source
            })
            .eq('id', article.id);
          
          if (error) {
            console.error(`❌ Failed to update article ${article.id}:`, error);
          } else {
            console.log(`✅ Updated database for article ${article.id}`);
          }
        } catch (error) {
          console.error(`❌ Database update error for article ${article.id}:`, error);
        }
      }
    } else {
      console.log(`❌ URL not found`);
      results.push({
        ...article,
        status: 'not_found'
      });
      notFound++;
    }
    
    // Rate limiting - wait 2 seconds between requests
    if (i < articles.length - 1) {
      console.log(`⏳ Waiting 2 seconds...`);
      await delay(2000);
    }
  }
  
  return {
    results,
    stats: {
      total: articles.length,
      found,
      notFound,
      successRate: Math.round((found / articles.length) * 100)
    }
  };
}

function extractCompanyFromTitle(title) {
  // Simple extraction of company name from title
  const words = title.split(' ').slice(0, 3);
  return words.join(' ');
}

async function main() {
  console.log('🚀 Starting URL finder for older articles...');
  console.log(`📡 Connecting to Supabase: ${supabaseUrl}`);
  
  try {
    // Fetch articles from 2025-06-20 and earlier without source_url
    const { data: articles, error } = await supabase
      .from('deals')
      .select('*')
      .lte('created_at', '2025-06-20T23:59:59')
      .or('source_url.is.null,source_url.eq.')
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }
    
    console.log(`📊 Found ${articles.length} older articles without source URLs`);
    
    if (articles.length === 0) {
      console.log('✅ No articles need URL updates');
      return;
    }
    
    // Show sample of articles
    console.log(`\n📋 SAMPLE ARTICLES MISSING URLS:`);
    articles.slice(0, 5).forEach((article, i) => {
      console.log(`${i + 1}. "${article.title}" (${article.created_at})`);
      console.log(`   Source: ${article.source}`);
      console.log(`   URL: ${article.source_url || 'MISSING'}`);
    });
    
    if (articles.length > 5) {
      console.log(`   ... and ${articles.length - 5} more articles`);
    }
    
    // Ask for confirmation
    console.log(`\n🤖 READY TO SEARCH FOR ${articles.length} MISSING URLS`);
    console.log('This will use Perplexity API to find source URLs.');
    console.log(`Estimated cost: ~$${(articles.length * 0.005).toFixed(2)} (${articles.length} requests × $0.005)`);
    console.log(`Estimated time: ~${Math.ceil(articles.length * 2 / 60)} minutes`);
    console.log('\nChoose an option:');
    console.log('1. Type "SEARCH" to find URLs (no database updates)');
    console.log('2. Type "UPDATE" to find URLs and update database');
    console.log('3. Type "CANCEL" to abort');
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('Your choice: ', async (answer) => {
      const choice = answer.toUpperCase();
      
      if (choice === 'SEARCH' || choice === 'UPDATE') {
        const updateDb = choice === 'UPDATE';
        
        console.log(`\n🔍 Starting URL search (${updateDb ? 'with' : 'without'} database updates)...`);
        
        const result = await findMissingUrls(articles, updateDb);
        
        console.log(`\n📊 SEARCH RESULTS:`);
        console.log(`Total articles processed: ${result.stats.total}`);
        console.log(`URLs found: ${result.stats.found}`);
        console.log(`URLs not found: ${result.stats.notFound}`);
        console.log(`Success rate: ${result.stats.successRate}%`);
        
        // Show found URLs
        if (result.stats.found > 0) {
          console.log(`\n✅ FOUND URLS:`);
          result.results
            .filter(r => r.status === 'found')
            .forEach((article, i) => {
              console.log(`${i + 1}. "${article.title.substring(0, 60)}..."`);
              console.log(`   URL: ${article.newUrl}`);
              console.log(`   Source: ${article.newSource}`);
            });
        }
        
        if (result.stats.notFound > 0) {
          console.log(`\n❌ URLS NOT FOUND:`);
          result.results
            .filter(r => r.status === 'not_found')
            .slice(0, 10)
            .forEach((article, i) => {
              console.log(`${i + 1}. "${article.title.substring(0, 60)}..."`);
            });
          
          if (result.stats.notFound > 10) {
            console.log(`   ... and ${result.stats.notFound - 10} more`);
          }
        }
        
        if (updateDb) {
          console.log(`\n🎉 DATABASE UPDATE COMPLETE!`);
          console.log(`Updated ${result.stats.found} articles with source URLs`);
        }
        
      } else {
        console.log('❌ Search cancelled');
      }
      
      rl.close();
    });
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error); 