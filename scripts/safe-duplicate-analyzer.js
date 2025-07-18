#!/usr/bin/env node

/**
 * Safe Duplicate Analyzer
 * 
 * This script ONLY reads from the deals table and identifies duplicates using OpenAI.
 * It NEVER deletes or modifies the original deals table.
 * Results are stored in a separate duplicate_analysis table.
 */

const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');
const readline = require('readline');

// Safety configuration
const SAFETY_CONFIG = {
  READ_ONLY_MODE: true,
  NEVER_DELETE: true,
  NEVER_MODIFY_DEALS_TABLE: true,
  MAX_ARTICLES_PER_BATCH: 50, // Process in small batches for safety
  SIMILARITY_THRESHOLD: 0.7, // Only store pairs with similarity >= 70%
  CONFIRMATION_REQUIRED: true
};

console.log('🔒 SAFE DUPLICATE ANALYZER - READ-ONLY MODE');
console.log('=' .repeat(60));
console.log('✅ This script ONLY reads from deals table');
console.log('✅ This script NEVER deletes or modifies deals table');
console.log('✅ Results stored in separate duplicate_analysis table');
console.log('=' .repeat(60));

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Safety check function
function verifySafetySettings() {
  if (!SAFETY_CONFIG.READ_ONLY_MODE) {
    throw new Error('❌ SAFETY ERROR: READ_ONLY_MODE must be true');
  }
  if (!SAFETY_CONFIG.NEVER_DELETE) {
    throw new Error('❌ SAFETY ERROR: NEVER_DELETE must be true');
  }
  if (!SAFETY_CONFIG.NEVER_MODIFY_DEALS_TABLE) {
    throw new Error('❌ SAFETY ERROR: NEVER_MODIFY_DEALS_TABLE must be true');
  }
  console.log('✅ Safety settings verified');
}

// Get user confirmation
async function getUserConfirmation() {
  if (!SAFETY_CONFIG.CONFIRMATION_REQUIRED) {
    return true;
  }
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('\n🔍 This will analyze all articles for duplicates (READ-ONLY). Continue? (y/N): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// Read all articles from deals table (READ-ONLY)
async function getAllArticles() {
  console.log('📖 Reading all articles from deals table (READ-ONLY)...');
  
  const { data: articles, error } = await supabase
    .from('deals')
    .select('id, title, summary, content, date, source, upvotes, created_at')
    .order('created_at', { ascending: false });
  
  if (error) {
    throw new Error(`❌ Error reading articles: ${error.message}`);
  }
  
  console.log(`📊 Found ${articles.length} articles to analyze`);
  return articles;
}

// Analyze two articles for similarity using OpenAI
async function analyzeArticleSimilarity(article1, article2) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a duplicate detection expert. Analyze two private credit/finance articles and determine if they are duplicates.

ANALYSIS CRITERIA:
1. Content similarity (same deals, companies, amounts)
2. Title similarity (same core information)
3. Source similarity (same news event)
4. Date proximity (same timeframe)

CONFIDENCE LEVELS:
- HIGH: Clearly the same story/deal (90%+ similar)
- MEDIUM: Likely duplicates but with some differences (70-89% similar)
- LOW: Some similarity but probably different stories (50-69% similar)

RECOMMENDED ACTIONS:
- keep_first: Keep article 1, remove article 2
- keep_second: Keep article 2, remove article 1
- merge: Combine information from both
- keep_both: Not duplicates, keep both

Return JSON with:
{
  "is_duplicate": boolean,
  "similarity_score": number (0.0-1.0),
  "confidence_level": "high|medium|low",
  "reason": "detailed explanation",
  "recommended_action": "keep_first|keep_second|merge|keep_both",
  "key_similarities": ["list of similar elements"],
  "key_differences": ["list of different elements"]
}`
        },
        {
          role: 'user',
          content: `Compare these two articles:

ARTICLE 1:
Title: ${article1.title}
Date: ${article1.date}
Source: ${article1.source}
Summary: ${article1.summary}

ARTICLE 2:
Title: ${article2.title}
Date: ${article2.date}
Source: ${article2.source}
Summary: ${article2.summary}

Provide detailed duplicate analysis.`
        }
      ],
      max_tokens: 800,
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const analysis = JSON.parse(response.choices[0].message.content);
    
    return {
      similarity_score: analysis.similarity_score,
      confidence_level: analysis.confidence_level,
      reason: analysis.reason,
      recommended_action: analysis.recommended_action,
      analysis_details: analysis
    };
    
  } catch (error) {
    console.error(`❌ Error analyzing articles ${article1.id} and ${article2.id}:`, error);
    return null;
  }
}

// Store duplicate analysis result (SAFE - only writes to analysis table)
async function storeDuplicateAnalysis(article1, article2, analysis) {
  try {
    const { data, error } = await supabase
      .from('duplicate_analysis')
      .insert({
        article_1_id: article1.id,
        article_2_id: article2.id,
        similarity_score: analysis.similarity_score,
        similarity_reason: analysis.reason,
        analysis_method: 'openai_content_analysis',
        recommended_action: analysis.recommended_action,
        confidence_level: analysis.confidence_level,
        analysis_details: analysis.analysis_details,
        analyzed_by: 'openai_gpt4'
      });
    
    if (error) {
      // Check if it's a duplicate entry (which is fine)
      if (error.code === '23505') {
        console.log(`⚠️ Analysis already exists for articles ${article1.id} and ${article2.id}`);
        return false;
      }
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Error storing analysis for articles ${article1.id} and ${article2.id}:`, error);
    return false;
  }
}

// Main analysis function
async function analyzeDuplicates() {
  try {
    // Safety verification
    verifySafetySettings();
    
    // Get user confirmation
    const confirmed = await getUserConfirmation();
    if (!confirmed) {
      console.log('❌ Analysis cancelled by user');
      return;
    }
    
    // Read all articles (READ-ONLY)
    const articles = await getAllArticles();
    
    if (articles.length === 0) {
      console.log('❌ No articles found to analyze');
      return;
    }
    
    console.log(`\n🔍 Starting duplicate analysis of ${articles.length} articles...`);
    console.log(`📦 Processing in batches of ${SAFETY_CONFIG.MAX_ARTICLES_PER_BATCH}`);
    
    let totalComparisons = 0;
    let duplicatesFound = 0;
    let analysisStored = 0;
    let processed = 0;
    
    // Process articles in batches for safety
    for (let i = 0; i < articles.length; i += SAFETY_CONFIG.MAX_ARTICLES_PER_BATCH) {
      const batch = articles.slice(i, i + SAFETY_CONFIG.MAX_ARTICLES_PER_BATCH);
      console.log(`\n📦 Processing batch ${Math.floor(i / SAFETY_CONFIG.MAX_ARTICLES_PER_BATCH) + 1}/${Math.ceil(articles.length / SAFETY_CONFIG.MAX_ARTICLES_PER_BATCH)} (${batch.length} articles)`);
      
      // Compare each article with all others in the batch
      for (let j = 0; j < batch.length; j++) {
        for (let k = j + 1; k < batch.length; k++) {
          const article1 = batch[j];
          const article2 = batch[k];
          
          totalComparisons++;
          
          // Analyze similarity
          const analysis = await analyzeArticleSimilarity(article1, article2);
          
          if (analysis && analysis.similarity_score >= SAFETY_CONFIG.SIMILARITY_THRESHOLD) {
            duplicatesFound++;
            
            console.log(`🔍 Found potential duplicate (${analysis.similarity_score.toFixed(3)}): "${article1.title.substring(0, 50)}..." vs "${article2.title.substring(0, 50)}..."`);
            console.log(`   📊 Confidence: ${analysis.confidence_level}, Action: ${analysis.recommended_action}`);
            
            // Store analysis result (SAFE - only writes to analysis table)
            const stored = await storeDuplicateAnalysis(article1, article2, analysis);
            if (stored) {
              analysisStored++;
            }
          }
          
          processed++;
          
          // Progress update
          if (processed % 10 === 0) {
            console.log(`📊 Progress: ${processed}/${totalComparisons} comparisons complete`);
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
    
    // Final statistics
    console.log('\n' + '='.repeat(60));
    console.log('📊 ANALYSIS COMPLETE - RESULTS SUMMARY');
    console.log('='.repeat(60));
    console.log(`📖 Total articles analyzed: ${articles.length}`);
    console.log(`🔍 Total comparisons made: ${totalComparisons}`);
    console.log(`🔍 Potential duplicates found: ${duplicatesFound}`);
    console.log(`💾 Analysis results stored: ${analysisStored}`);
    console.log(`📊 Duplicate rate: ${((duplicatesFound / totalComparisons) * 100).toFixed(2)}%`);
    
    // Show summary from database
    const { data: summary } = await supabase
      .from('duplicate_analysis_summary')
      .select('*')
      .single();
    
    if (summary) {
      console.log('\n📈 DATABASE SUMMARY:');
      console.log(`   Total duplicate pairs: ${summary.total_duplicate_pairs}`);
      console.log(`   High confidence: ${summary.high_confidence_duplicates}`);
      console.log(`   Medium confidence: ${summary.medium_confidence_duplicates}`);
      console.log(`   Low confidence: ${summary.low_confidence_duplicates}`);
      console.log(`   Average similarity: ${(summary.average_similarity_score * 100).toFixed(1)}%`);
    }
    
    console.log('\n✅ Analysis complete! Check the duplicate_analysis table for results.');
    console.log('🔒 Original deals table was never modified (READ-ONLY mode)');
    
  } catch (error) {
    console.error('❌ Error during analysis:', error);
    process.exit(1);
  }
}

// Run the analysis
if (require.main === module) {
  analyzeDuplicates().catch(console.error);
}

module.exports = { analyzeDuplicates }; 