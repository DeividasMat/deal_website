#!/usr/bin/env node

/**
 * AGGRESSIVE SEMANTIC DUPLICATE CLEANUP
 * 
 * This script uses improved algorithms to detect and clean semantic duplicates.
 * It's more aggressive than the previous version to catch obvious duplicates.
 * Prioritizes free, accessible sources over paid sources.
 */

// Load environment variables
require('dotenv').config();

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

console.log('🔥 AGGRESSIVE SEMANTIC DUPLICATE CLEANUP');
console.log('=' .repeat(60));
console.log('✅ More aggressive duplicate detection');
console.log('✅ Prioritizes free accessible sources');
console.log('✅ Handles obvious semantic duplicates');
console.log('=' .repeat(60));

// Enhanced source scoring system
function calculateSourceScore(article) {
  let score = 0;
  
  // SOURCE URL SCORING (free sources get highest priority)
  if (article.source_url) {
    const url = article.source_url.toLowerCase();
    
    // TOP FREE SOURCES
    if (url.includes('reuters.com') || url.includes('businesswire.com') || 
        url.includes('prnewswire.com') || url.includes('yahoo.com') || 
        url.includes('marketwatch.com') || url.includes('cnbc.com')) {
      score += 100; // Highest priority
    }
    // COMPANY OFFICIAL NEWSROOMS
    else if (url.includes('newsroom') || url.includes('investor') || 
             url.includes('press') || url.includes('news.')) {
      score += 90; // Company official sources
    }
    // FINANCIAL PUBLICATIONS
    else if (url.includes('seekingalpha.com') || url.includes('benzinga.com') || 
             url.includes('ft.com') || url.includes('wsj.com')) {
      score += 70;
    }
    // PAID SOURCES (lower priority)
    else if (url.includes('bloomberg.com')) {
      score += 30; // Bloomberg is paid
    }
    // GENERIC HTTPS
    else if (url.startsWith('https://')) {
      score += 50;
    }
  }
  
  // SOURCE NAME SCORING
  if (article.source) {
    const source = article.source.toLowerCase();
    
    // TOP FREE SOURCES
    if (source.includes('reuters') || source.includes('business wire') || 
        source.includes('pr newswire') || source.includes('yahoo') || 
        source.includes('marketwatch') || source.includes('cnbc')) {
      score += 50;
    }
    // COMPANY NEWSROOMS
    else if (source.includes('newsroom') || source.includes('investor') || 
             source.includes('press') || source.includes('official')) {
      score += 45;
    }
    // FINANCIAL PUBLICATIONS
    else if (source.includes('seeking alpha') || source.includes('benzinga') || 
             source.includes('financial times') || source.includes('wsj')) {
      score += 35;
    }
    // PAID SOURCES (much lower priority)
    else if (source.includes('bloomberg terminal')) {
      score += 5; // Very low priority for paid terminal
    }
    else if (source.includes('bloomberg')) {
      score += 15; // Lower priority for Bloomberg
    }
    // GENERIC SOURCES
    else if (source.includes('financial news') || source.includes('news')) {
      score += 10; // Generic news sources
    }
  }
  
  // CONTENT QUALITY SCORING
  if (article.title && article.title.length > 20) {
    score += 20;
  }
  
  if (article.summary && article.summary.length > 100) {
    score += 15;
  }
  
  // ENGAGEMENT SCORING
  score += (article.upvotes || 0) * 3;
  
  return score;
}

// Improved semantic duplicate detection
function detectSemanticDuplicate(article1, article2) {
  const title1 = article1.title.toLowerCase();
  const title2 = article2.title.toLowerCase();
  
  // EXACT COMPANY AND AMOUNT MATCHING
  const companies = ['geo', 'fidelity', 'pantheon', 'blackstone', 'apollo', 'kkr', 'carlyle', 'ares', 'oaktree', 'blackrock'];
  const amounts = title1.match(/\$[\d,]+\.?\d*[mkb]?/g) || [];
  const amounts2 = title2.match(/\$[\d,]+\.?\d*[mkb]?/g) || [];
  
  // Check for same company
  let sameCompany = false;
  for (const company of companies) {
    if (title1.includes(company) && title2.includes(company)) {
      sameCompany = true;
      break;
    }
  }
  
  // Check for same amounts
  let sameAmount = false;
  for (const amount of amounts) {
    if (amounts2.includes(amount)) {
      sameAmount = true;
      break;
    }
  }
  
  // Check for financial keywords
  const financialKeywords = ['credit', 'facility', 'loan', 'fund', 'capital', 'financing', 'debt', 'investment', 'raises', 'closes', 'secures'];
  let commonFinancialTerms = 0;
  for (const keyword of financialKeywords) {
    if (title1.includes(keyword) && title2.includes(keyword)) {
      commonFinancialTerms++;
    }
  }
  
  // WORD SIMILARITY ANALYSIS
  const words1 = title1.split(' ').filter(word => word.length > 3);
  const words2 = title2.split(' ').filter(word => word.length > 3);
  const commonWords = words1.filter(word => words2.includes(word));
  const wordSimilarity = commonWords.length / Math.max(words1.length, words2.length);
  
  // DUPLICATE SCORING
  let duplicateScore = 0;
  
  // High confidence duplicates
  if (sameCompany && sameAmount && commonFinancialTerms >= 2) {
    duplicateScore = 0.95; // Very high confidence
  }
  else if (sameCompany && sameAmount && commonFinancialTerms >= 1) {
    duplicateScore = 0.9; // High confidence
  }
  else if (sameCompany && commonFinancialTerms >= 2 && wordSimilarity > 0.4) {
    duplicateScore = 0.8; // Medium-high confidence
  }
  else if (wordSimilarity > 0.6 && commonFinancialTerms >= 2) {
    duplicateScore = 0.75; // Medium confidence
  }
  else if (wordSimilarity > 0.5 && sameAmount) {
    duplicateScore = 0.7; // Medium confidence
  }
  
  return {
    isDuplicate: duplicateScore >= 0.7,
    similarity: duplicateScore,
    confidence: duplicateScore >= 0.9 ? 'high' : duplicateScore >= 0.8 ? 'medium-high' : 'medium',
    reason: `Company: ${sameCompany}, Amount: ${sameAmount}, Financial terms: ${commonFinancialTerms}, Word similarity: ${wordSimilarity.toFixed(2)}`,
    sameCompany,
    sameAmount,
    commonFinancialTerms,
    wordSimilarity
  };
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

// Find all semantic duplicates with improved algorithm
async function findSemanticDuplicates(articles) {
  console.log(`🔍 Analyzing ${articles.length} articles for semantic duplicates...`);
  
  const duplicates = [];
  let comparisons = 0;
  
  for (let i = 0; i < articles.length; i++) {
    for (let j = i + 1; j < articles.length; j++) {
      comparisons++;
      
      const article1 = articles[i];
      const article2 = articles[j];
      
      // Skip if articles are from very different dates (more than 30 days apart)
      const date1 = new Date(article1.created_at || article1.date);
      const date2 = new Date(article2.created_at || article2.date);
      const daysDiff = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff > 30) continue;
      
      // Analyze semantic similarity
      const analysis = detectSemanticDuplicate(article1, article2);
      
      if (analysis.isDuplicate) {
        console.log(`🔍 Found duplicate (${(analysis.similarity * 100).toFixed(1)}%): "${article1.title}" vs "${article2.title}"`);
        
        // Determine which to keep based on source scoring
        const score1 = calculateSourceScore(article1);
        const score2 = calculateSourceScore(article2);
        
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
      if (comparisons % 100 === 0) {
        console.log(`📊 Processed ${comparisons} comparisons, found ${duplicates.length} duplicates...`);
      }
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
    console.log(`\n${index + 1}. DUPLICATE PAIR (${(dup.analysis.similarity * 100).toFixed(1)}% similar, ${dup.analysis.confidence} confidence):`);
    console.log(`   ✅ KEEP:   [${dup.keepArticle.id}] "${dup.keepArticle.title}"`);
    console.log(`      Score: ${dup.score1 > dup.score2 ? dup.score1 : dup.score2} | Source: ${dup.keepArticle.source} | URL: ${dup.keepArticle.source_url || 'None'}`);
    console.log(`   ❌ DELETE: [${dup.deleteArticle.id}] "${dup.deleteArticle.title}"`);
    console.log(`      Score: ${dup.score1 > dup.score2 ? dup.score2 : dup.score1} | Source: ${dup.deleteArticle.source} | URL: ${dup.deleteArticle.source_url || 'None'}`);
    console.log(`   📝 Analysis: ${dup.analysis.reason}`);
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
      console.log(`🗑️ Deleting: [${dup.deleteArticle.id}] "${dup.deleteArticle.title}" (${dup.deleteArticle.source})`);
      console.log(`✅ Keeping: [${dup.keepArticle.id}] "${dup.keepArticle.title}" (${dup.keepArticle.source})`);
      
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