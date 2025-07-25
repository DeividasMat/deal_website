const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

console.log('🚀 Starting summary improvement...');
console.log('📡 Connecting to Supabase:', supabaseUrl);

async function improveSummary(title, currentSummary, currentSource) {
  console.log('🤖 Improving:', title.substring(0, 60) + '...');
  
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

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 400
    });

    const content = response.choices[0].message.content.trim();
    
    const summaryMatch = content.match(/SUMMARY:\s*(.*?)(?=SOURCE:|$)/s);
    const sourceMatch = content.match(/SOURCE:\s*(.+)/);
    
    const improvedSummary = summaryMatch ? summaryMatch[1].trim() : currentSummary;
    const improvedSource = sourceMatch ? sourceMatch[1].trim() : currentSource;
    
    console.log('✅ Improved summary:', improvedSummary.substring(0, 100) + '...');
    console.log('✅ Improved source:', improvedSource);
    
    return {
      summary: improvedSummary,
      source: improvedSource
    };
    
  } catch (error) {
    console.error('❌ OpenAI failed for "' + title + '":', error.message);
    return {
      summary: currentSummary,
      source: currentSource
    };
  }
}

async function processAllArticles() {
  try {
    const { data: articles, error } = await supabase
      .from('deals')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw new Error('Supabase error: ' + error.message);
    
    console.log('📊 Found', articles.length, 'total articles');
    
    if (articles.length === 0) {
      console.log('✅ No articles found');
      return;
    }
    
    console.log('\n📋 SAMPLE ARTICLES:');
    articles.slice(0, 3).forEach((article, i) => {
      console.log((i + 1) + '. "' + article.title + '"');
      console.log('   Summary:', (article.summary || 'No summary').substring(0, 100) + '...');
      console.log('   Source:', article.source);
    });
    
    if (articles.length > 3) {
      console.log('   ... and', (articles.length - 3), 'more articles');
    }
    
    console.log('\n🤖 READY TO IMPROVE', articles.length, 'ARTICLE SUMMARIES AND SOURCES');
    console.log('This will use OpenAI GPT-4 to:');
    console.log('  - Rewrite summaries to 2-3 professional sentences');
    console.log('  - Remove unnecessary commas and improve clarity'); 
    console.log('  - Upgrade generic sources to specific publication names');
    console.log('Estimated cost: ~$' + (articles.length * 0.02).toFixed(2));
    console.log('Estimated time: ~' + Math.ceil(articles.length * 1 / 60), 'minutes');
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('\nType "UPDATE" to improve and update database, or "CANCEL" to abort: ', async (answer) => {
      if (answer.toUpperCase() === 'UPDATE') {
        console.log('\n🔧 Starting improvement process...');
        
        let improved = 0;
        let unchanged = 0;
        
        for (let i = 0; i < articles.length; i++) {
          const article = articles[i];
          console.log('\n📰 [' + (i + 1) + '/' + articles.length + ']', article.title.substring(0, 60) + '...');
          
          const improvements = await improveSummary(
            article.title,
            article.summary || 'No summary available',
            article.source
          );
          
          const summaryChanged = improvements.summary !== article.summary;
          const sourceChanged = improvements.source !== article.source;
          
          if (summaryChanged || sourceChanged) {
            try {
              const updateData = {};
              if (summaryChanged) updateData.summary = improvements.summary;
              if (sourceChanged) updateData.source = improvements.source;
              
              const { error } = await supabase
                .from('deals')
                .update(updateData)
                .eq('id', article.id);
              
              if (error) {
                console.error('❌ Update failed for article', article.id + ':', error);
              } else {
                console.log('✅ Updated article', article.id);
                improved++;
              }
            } catch (error) {
              console.error('❌ Database error for article', article.id + ':', error);
            }
          } else {
            console.log('⚠️ No changes needed');
            unchanged++;
          }
          
          if (i < articles.length - 1) {
            console.log('⏳ Waiting 1 second...');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        console.log('\n🎉 IMPROVEMENT COMPLETE!');
        console.log('Total articles:', articles.length);
        console.log('Articles improved:', improved);
        console.log('Articles unchanged:', unchanged);
        console.log('Success rate:', Math.round((improved / articles.length) * 100) + '%');
        
      } else {
        console.log('❌ Improvement cancelled');
      }
      
      rl.close();
    });
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

processAllArticles();
