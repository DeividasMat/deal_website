const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function improveSummaryAndSource(title, currentSummary, currentSource) {
  console.log('🤖 Improving: ' + title.substring(0, 60) + '...');
  
  try {
    const prompt = `You are a professional financial news editor. Rewrite this article summary and improve the source attribution.

SUMMARY REQUIREMENTS:
1. Create EXACTLY 2-3 sentences (no more, no less)
2. First sentence: WHO did WHAT for HOW MUCH
3. Second sentence: Key transaction details (structure, terms, participants)
4. Third sentence (if needed): Strategic significance or market context
5. Remove ALL unnecessary commas - only use commas where grammatically essential
6. Use bold formatting for: **company names**, **dollar amounts**, **deal types**, **key metrics**
7. Make it professional and informative

SOURCE REQUIREMENTS:
1. If source is generic like "Perplexity + OpenAI", "Deal News", "Company Press Release" - improve it to a specific publication
2. For financial deals, prefer: Bloomberg, Reuters, Financial Times, Wall Street Journal, PR Newswire, GlobeNewswire, Business Wire
3. For credit ratings: S&P Global Ratings, Moody's, Fitch Ratings
4. Keep good sources like "Fitch Ratings", "Bloomberg", "Reuters" unchanged

RESPONSE FORMAT:
SUMMARY: [improved 2-3 sentence summary]
SOURCE: [improved source name]

Title: ${title}
Current Summary: ${currentSummary}
Current Source: ${currentSource}

Please improve both the summary and source following all requirements above.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 400
    });

    const content = response.choices[0].message.content.trim();
    
    // Extract improved summary and source
    const summaryMatch = content.match(/SUMMARY:\s*(.*?)(?=SOURCE:|$)/s);
    const sourceMatch = content.match(/SOURCE:\s*(.+)/);
    
    const improvedSummary = summaryMatch ? summaryMatch[1].trim() : currentSummary;
    const improvedSource = sourceMatch ? sourceMatch[1].trim() : currentSource;
    
    console.log('✅ Improved summary: ' + improvedSummary.substring(0, 100) + '...');
    console.log('✅ Improved source: ' + improvedSource);
    
    return {
      summary: improvedSummary,
      source: improvedSource
    };
    
  } catch (error) {
    console.error('❌ OpenAI improvement failed for "' + title + '":', error.message);
    return {
      summary: currentSummary,
      source: currentSource
    };
  }
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processArticles(articles, updateDatabase = false) {
  console.log('🔧 Improving summaries and sources for ' + articles.length + ' articles...');
  
  const results = [];
  let improved = 0;
  let failed = 0;
  
  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    console.log('\\n📰 [' + (i + 1) + '/' + articles.length + '] Processing: "' + article.title.substring(0, 60) + '..."');
    console.log('   Current summary: ' + (article.summary || 'No summary').substring(0, 100) + '...');
    console.log('   Source: ' + article.source);
    
    // Improve summary and source with OpenAI
    const improvements = await improveSummaryAndSource(
      article.title,
      article.summary || 'No summary available',
      article.source
    );
    
    const summaryChanged = improvements.summary !== article.summary;
    const sourceChanged = improvements.source !== article.source;
    
    if (summaryChanged || sourceChanged) {
      console.log('✅ Article improved (Summary: ' + (summaryChanged ? 'Yes' : 'No') + ', Source: ' + (sourceChanged ? 'Yes' : 'No') + ')');
      
      results.push({
        id: article.id,
        title: article.title,
        originalSummary: article.summary,
        originalSource: article.source,
        improvedSummary: improvements.summary,
        improvedSource: improvements.source,
        status: 'improved'
      });
      improved++;
      
      // Update database if requested
      if (updateDatabase) {
        try {
          const updateData = {};
          if (summaryChanged) updateData.summary = improvements.summary;
          if (sourceChanged) updateData.source = improvements.source;
          
          const { error } = await supabase
            .from('deals')
            .update(updateData)
            .eq('id', article.id);
          
          if (error) {
            console.error('❌ Failed to update article ' + article.id + ':', error);
          } else {
            console.log('✅ Updated database for article ' + article.id);
          }
        } catch (error) {
          console.error('❌ Database update error for article ' + article.id + ':', error);
        }
      }
    } else {
      console.log('⚠️ Article unchanged');
      results.push({
        id: article.id,
        title: article.title,
        status: 'unchanged'
      });
      failed++;
    }
    
    // Rate limiting - wait 1 second between requests
    if (i < articles.length - 1) {
      console.log('⏳ Waiting 1 second...');
      await delay(1000);
    }
  }
  
  return {
    results,
    stats: {
      total: articles.length,
      improved,
      failed,
      successRate: Math.round((improved / articles.length) * 100)
    }
  };
}

async function main() {
  console.log('🚀 Starting summary and source improvement script...');
  console.log('📡 Connecting to Supabase: ' + supabaseUrl);
  
  try {
    // Fetch all articles
    const { data: articles, error } = await supabase
      .from('deals')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error('Supabase error: ' + error.message);
    }
    
    console.log('📊 Found ' + articles.length + ' total articles');
    
    if (articles.length === 0) {
      console.log('✅ No articles found - nothing to improve');
      return;
    }
    
    // Show sample of articles
    console.log('\\n📋 SAMPLE ARTICLES TO IMPROVE:');
    articles.slice(0, 3).forEach((article, i) => {
      console.log((i + 1) + '. "' + article.title + '"');
      console.log('   Current summary: ' + (article.summary || 'No summary').substring(0, 100) + '...');
      console.log('   Source: ' + article.source);
    });
    
    if (articles.length > 3) {
      console.log('   ... and ' + (articles.length - 3) + ' more articles');
    }
    
    // Ask for confirmation
    console.log('\\n🤖 READY TO IMPROVE ' + articles.length + ' ARTICLE SUMMARIES AND SOURCES');
    console.log('This will use OpenAI GPT-4 to:');
    console.log('  - Rewrite summaries to 2-3 professional sentences with proper formatting');
    console.log('  - Remove unnecessary commas and improve clarity');
    console.log('  - Upgrade generic sources to specific publication names');
    console.log('Estimated cost: ~$' + (articles.length * 0.02).toFixed(2) + ' (' + articles.length + ' requests × $0.02)');
    console.log('Estimated time: ~' + Math.ceil(articles.length * 1 / 60) + ' minutes');
    console.log('\\nChoose an option:');
    console.log('1. Type "PREVIEW" to improve articles (no database updates)');
    console.log('2. Type "UPDATE" to improve articles and update database');
    console.log('3. Type "CANCEL" to abort');
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('Your choice: ', async (answer) => {
      const choice = answer.toUpperCase();
      
      if (choice === 'PREVIEW' || choice === 'UPDATE') {
        const updateDb = choice === 'UPDATE';
        
        console.log('\\n🔧 Starting summary and source improvement (' + (updateDb ? 'with' : 'without') + ' database updates)...');
        
        const result = await processArticles(articles, updateDb);
        
        console.log('\\n📊 IMPROVEMENT RESULTS:');
        console.log('Total articles processed: ' + result.stats.total);
        console.log('Articles improved: ' + result.stats.improved);
        console.log('Articles unchanged: ' + result.stats.failed);
        console.log('Success rate: ' + result.stats.successRate + '%');
        
        // Show improved articles
        if (result.stats.improved > 0) {
          console.log('\\n✅ IMPROVED ARTICLES (first 5):');
          result.results
            .filter(r => r.status === 'improved')
            .slice(0, 5)
            .forEach((article, i) => {
              console.log('\\n' + (i + 1) + '. "' + article.title.substring(0, 80) + '..."');
              
              // Show summary changes
              if (article.improvedSummary !== article.originalSummary) {
                console.log('   SUMMARY BEFORE: ' + (article.originalSummary || 'None').substring(0, 120) + '...');
                console.log('   SUMMARY AFTER:  ' + article.improvedSummary.substring(0, 120) + '...');
              }
              
              // Show source changes
              if (article.improvedSource !== article.originalSource) {
                console.log('   SOURCE BEFORE: ' + article.originalSource);
                console.log('   SOURCE AFTER:  ' + article.improvedSource);
              }
            });
          
          if (result.stats.improved > 5) {
            console.log('   ... and ' + (result.stats.improved - 5) + ' more improved articles');
          }
        }
        
        if (updateDb) {
          console.log('\\n🎉 DATABASE UPDATE COMPLETE!');
          console.log('Updated ' + result.stats.improved + ' articles with improved summaries and sources');
        }
        
      } else {
        console.log('❌ Article improvement cancelled');
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