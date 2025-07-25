#!/usr/bin/env node

/**
 * COMPREHENSIVE SEMANTIC DUPLICATE CLEANUP
 * 
 * This script finds and removes all semantic duplicates from the database.
 * It uses OpenAI to detect duplicates with different wording but same news story.
 * Prioritizes free, accessible sources over paid sources.
 */

const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');
const readline = require('readline');

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔍 COMPREHENSIVE SEMANTIC DUPLICATE CLEANUP');
console.log('=' .repeat(60));
console.log('✅ Detects semantic duplicates using OpenAI');
console.log('✅ Prioritizes free accessible sources');
console.log('✅ Removes duplicates while keeping best articles');
console.log('=' .repeat(60));

// Calculate enhanced article score prioritizing free sources
function calculateArticleScore(article) {
  let score = 0;
  
  // SOURCE ACCESSIBILITY (prioritize free sources)
  if (article.source_url) {
    const url = article.source_url.toLowerCase();
    
    // FREE ACCESSIBLE SOURCES (highest priority)
    if (url.includes('reuters.com') || url.includes('yahoo.com') || 
        url.includes('marketwatch.com') || url.includes('cnbc.com') ||
        url.includes('businesswire.com') || url.includes('prnewswire.com') ||
        url.includes('seekingalpha.com') || url.includes('benzinga.com')) {
      score += 50; // Highest score for free sources
    }
    // PARTIALLY FREE SOURCES
    else if (url.includes('ft.com') || url.includes('wsj.com')) {
      score += 30; // Some free articles
    }
    // PAID SOURCES (lower priority)
    else if (url.includes('bloomberg.com')) {
      score += 20; // Bloomberg Terminal is paid
    }
    // ANY HTTPS URL
    else if (url.startsWith('https://')) {
      score += 25; // Generic free source
    }
    else {
      score += 10; // Any URL is better than none
    }
  } else {
    // No URL = much lower score
    score -= 20;
  }
  
  // SOURCE NAME QUALITY (prefer known free sources)
  if (article.source) {
    const source = article.source.toLowerCase();
    
    // FREE NEWS SOURCES
    if (source.includes('reuters') || source.includes('yahoo') || 
        source.includes('marketwatch') || source.includes('cnbc') ||
        source.includes('business wire') || source.includes('pr newswire') ||
        source.includes('seeking alpha') || source.includes('benzinga') ||
        source.includes('ainvest')) {
      score += 25;
    }
    // PAID SOURCES (lower priority)
    else if (source.includes('bloomberg terminal')) {
      score += 10; // Lower score for paid sources
    }
    else if (source.includes('bloomberg')) {
      score += 15; // Slightly better than terminal
    }
    // GENERIC SOURCES
    else if (source.includes('financial news')) {
      score += 5; // Generic source
    }
    else {
      score += 8; // Any source is better than none
    }
  }
  
  // TITLE QUALITY (specific details)
  if (article.title) {
    const title = article.title.toLowerCase();
    
    // Length bonus
    score += Math.min(article.title.length / 8, 15);
    
    // Specificity bonus
    if (title.includes('$') || title.includes('million') || title.includes('billion')) {
      score += 15;
    }
    
    // Company names
    if (title.includes('apollo') || title.includes('blackstone') || 
        title.includes('kkr') || title.includes('ares') || 
        title.includes('oaktree') || title.includes('carlyle')) {
      score += 10;
    }
    
    // Transaction details
    if (title.includes('from') && title.includes('to')) {
      score += 10; // Shows increase amount
    }
    
    // Deal types
    if (title.includes('facility') || title.includes('credit') || 
        title.includes('loan') || title.includes('financing')) {
      score += 8;
    }
  }
  
  // SUMMARY QUALITY
  if (article.summary) {
    const summaryLength = article.summary.length;
    score += Math.min(summaryLength / 15, 20);
    
    // Bold formatting bonus
    if (article.summary.includes('**')) {
      score += 8;
    }
    
    // Detailed information
    if (article.summary.includes('$') && article.summary.includes('million')) {
      score += 5;
    }
  }
  
  // ENGAGEMENT
  score += (article.upvotes || 0) * 3;
  
  // RECENCY (slight preference for newer)
  if (article.created_at) {
    const hoursAgo = (Date.now() - new Date(article.created_at).getTime()) / (1000 * 60 * 60);
    if (hoursAgo < 24) score += 5;
    else if (hoursAgo < 48) score += 3;
  }
  
  return score;
}

// Detect semantic duplicates using OpenAI
async function detectSemanticDuplicate(article1, article2) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert at detecting duplicate financial news articles. Compare these two articles and determine if they report the same news story.

DUPLICATE CRITERIA:
- Same company/entity involved
- Same transaction type and amount
- Same time period (even if exact date differs)
- Same deal participants
- Same financial instruments

EXAMPLES OF DUPLICATES:
- "Geo Increases Revolving Credit Facility to $450M" vs "Geo Boosts Credit Facility to $450M from $310M"
- "Apollo Provides $500M Loan to TechCorp" vs "Apollo's $500M TechCorp Financing Deal"
- "KKR Raises $2B Fund" vs "KKR Closes $2B Private Equity Fund"

CONFIDENCE LEVELS:
- HIGH: Clearly the same deal/story (90%+ certain)
- MEDIUM: Likely the same deal with some differences (70-89% certain)  
- LOW: Some similarity but probably different deals (50-69% certain)

Return JSON with:
{
  "isDuplicate": boolean,
  "similarity": number (0.0-1.0),
  "confidence": "low|medium|high",
  "reason": "detailed explanation",
  "keyFactors": ["list of factors that make them similar/different"]
}`
        },
        {
          role: 'user',
          content: `Compare these two articles:

ARTICLE 1:
Title: ${article1.title}
Source: ${article1.source}
URL: ${article1.source_url || 'No URL'}
Summary: ${article1.summary || 'No summary'}

ARTICLE 2:
Title: ${article2.title}
Source: ${article2.source}
URL: ${article2.source_url || 'No URL'}
Summary: ${article2.summary || 'No summary'}

Are these the same news story?`
        }
      ],
      max_tokens: 400,
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const analysis = JSON.parse(response.choices[0].message.content || '{}');
    return analysis;
    
  } catch (error) {
    console.error('❌ Error in semantic duplicate detection:', error);
    return { isDuplicate: false, similarity: 0, confidence: 'low', reason: 'Analysis failed' };
  }
}

// Get all articles from database
async function getAllArticles() {
  console.log('📖 Reading all articles from database...');
  
  const { data: articles, error } = await supabase
    .from('deals')
    .select('id, title, summary, content, date, source, source_url, upvotes, created_at')
    .order('created_at', { ascending: false });
  
  if (error) {
    throw new Error(`❌ Error reading articles: ${error.message}`);
  }
  
  console.log(`📊 Found ${articles.length} articles to analyze`);
  return articles;
}

// Find all semantic duplicates
async function findSemanticDuplicates(articles) {
  console.log(`🔍 Analyzing ${articles.length} articles for semantic duplicates...`);
  
  const duplicates = [];
  let comparisons = 0;
  const maxComparisons = 200; // Limit to avoid excessive API calls
  
  // Focus on recent articles (last 30 days)
  const recentArticles = articles.filter(article => {
    const articleDate = new Date(article.created_at || article.date);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return articleDate >= thirtyDaysAgo;
  });
  
  console.log(`🔍 Focusing on ${recentArticles.length} recent articles (last 30 days)`);
  
  for (let i = 0; i < recentArticles.length && comparisons < maxComparisons; i++) {
    for (let j = i + 1; j < recentArticles.length && comparisons < maxComparisons; j++) {
      comparisons++;
      
      const article1 = recentArticles[i];
      const article2 = recentArticles[j];
      
      // Skip if articles are from very different dates
      const date1 = new Date(article1.created_at || article1.date);
      const date2 = new Date(article2.created_at || article2.date);
      const daysDiff = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff > 14) continue; // Skip articles more than 14 days apart
      
      console.log(`🔍 Comparing: "${article1.title}" vs "${article2.title}"`);
      
      // Analyze semantic similarity
      const analysis = await detectSemanticDuplicate(article1, article2);
      
      if (analysis.isDuplicate && analysis.similarity >= 0.7) {
        console.log(`✅ Found semantic duplicate (${(analysis.similarity * 100).toFixed(1)}%): "${article1.title}" vs "${article2.title}"`);
        
        // Determine which to keep based on enhanced scoring
        const score1 = calculateArticleScore(article1);
        const score2 = calculateArticleScore(article2);
        
        duplicates.push({
          article1,
          article2,
          analysis,
          keepArticle: score1 > score2 ? article1 : article2,
          deleteArticle: score1 > score2 ? article2 : article1,
          score1,
          score2
        });
      }
      
      // Progress logging
      if (comparisons % 25 === 0) {
        console.log(`📊 Processed ${comparisons} comparisons, found ${duplicates.length} duplicates...`);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  console.log(`✅ Analysis complete: ${duplicates.length} semantic duplicate pairs found in ${comparisons} comparisons`);
  return duplicates;
}

// Preview duplicates before deletion
function previewDuplicates(duplicates) {
  console.log('\n🔍 PREVIEW OF SEMANTIC DUPLICATES TO BE CLEANED:');
  console.log('=' .repeat(80));
  
  duplicates.forEach((dup, index) => {
    console.log(`\n${index + 1}. DUPLICATE PAIR (${(dup.analysis.similarity * 100).toFixed(1)}% similar):`);
    console.log(`   ✅ KEEP:   [${dup.keepArticle.id}] "${dup.keepArticle.title}"`);
    console.log(`      Score: ${dup.score1 > dup.score2 ? dup.score1.toFixed(1) : dup.score2.toFixed(1)} | Source: ${dup.keepArticle.source} | URL: ${dup.keepArticle.source_url || 'None'}`);
    console.log(`   ❌ DELETE: [${dup.deleteArticle.id}] "${dup.deleteArticle.title}"`);
    console.log(`      Score: ${dup.score1 > dup.score2 ? dup.score2.toFixed(1) : dup.score1.toFixed(1)} | Source: ${dup.deleteArticle.source} | URL: ${dup.deleteArticle.source_url || 'None'}`);
    console.log(`   📝 Reason: ${dup.analysis.reason}`);
  });
  
  console.log('\n' + '=' .repeat(80));
  console.log(`📊 SUMMARY: ${duplicates.length} duplicate pairs found`);
  console.log(`📊 Will delete: ${duplicates.length} articles`);
  console.log(`📊 Will keep: ${duplicates.length} articles`);
}

// Clean up semantic duplicates
async function cleanupDuplicates(duplicates, dryRun = true) {
  if (dryRun) {
    console.log('\n🔍 DRY RUN COMPLETE - No articles were deleted');
    return { deleted: 0, kept: 0, failed: 0 };
  }
  
  console.log('\n🗑️ PERFORMING LIVE CLEANUP...');
  
  let deleted = 0;
  let kept = 0;
  let failed = 0;
  
  for (const dup of duplicates) {
    try {
      console.log(`🗑️ Deleting: [${dup.deleteArticle.id}] "${dup.deleteArticle.title}"`);
      console.log(`✅ Keeping: [${dup.keepArticle.id}] "${dup.keepArticle.title}"`);
      
      const { error } = await supabase
        .from('deals')
        .delete()
        .eq('id', dup.deleteArticle.id);
      
      if (error) {
        console.error(`❌ Error deleting article ${dup.deleteArticle.id}: ${error.message}`);
        failed++;
      } else {
        deleted++;
        kept++;
        console.log(`✅ Successfully deleted duplicate ${dup.deleteArticle.id}`);
      }
      
      // Small delay between deletions
      await new Promise(resolve => setTimeout(resolve, 300));
      
    } catch (error) {
      console.error(`❌ Error processing duplicate:`, error);
      failed++;
    }
  }
  
  console.log(`\n🎉 Cleanup complete!`);
  console.log(`📊 Results: ${deleted} deleted, ${kept} kept, ${failed} failed`);
  
  return { deleted, kept, failed };
}

// Get user confirmation
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Main function
async function main() {
  try {
    // Get all articles
    const articles = await getAllArticles();
    
    if (articles.length < 2) {
      console.log('❌ Not enough articles for duplicate analysis');
      return;
    }
    
    // Find semantic duplicates
    const duplicates = await findSemanticDuplicates(articles);
    
    if (duplicates.length === 0) {
      console.log('✅ No semantic duplicates found!');
      return;
    }
    
    // Preview duplicates
    previewDuplicates(duplicates);
    
    // Get user confirmation for dry run
    const dryRunConfirm = await askQuestion('\n🔍 Run dry run first to see what would be deleted? (y/n): ');
    
    if (dryRunConfirm.toLowerCase() === 'y') {
      await cleanupDuplicates(duplicates, true);
      
      // Ask for live cleanup
      const liveConfirm = await askQuestion('\n⚠️ Proceed with LIVE cleanup? This will DELETE duplicates. (y/n): ');
      
      if (liveConfirm.toLowerCase() === 'y') {
        const finalConfirm = await askQuestion('🚨 FINAL CONFIRMATION: Type "DELETE" to confirm cleanup: ');
        
        if (finalConfirm === 'DELETE') {
          await cleanupDuplicates(duplicates, false);
          
          // Show final results
          const finalArticles = await getAllArticles();
          console.log(`\n📊 Final database state: ${finalArticles.length} articles remaining`);
          console.log(`📊 Removed ${articles.length - finalArticles.length} total duplicates`);
        } else {
          console.log('❌ Cleanup cancelled - incorrect confirmation');
        }
      } else {
        console.log('❌ Live cleanup cancelled');
      }
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    rl.close();
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main }; 