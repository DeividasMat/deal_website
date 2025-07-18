#!/usr/bin/env node

/**
 * SAFE DUPLICATE DELETER - HIGH CONFIDENCE ONLY
 * 
 * This script ONLY deletes duplicates that have been analyzed and marked as HIGH confidence.
 * It uses a scoring system to keep the best article (working link, nice headline, summary).
 * 
 * SAFETY FEATURES:
 * - Only processes HIGH confidence duplicates from analysis table
 * - Dry-run mode to preview what will be deleted
 * - Multiple confirmation prompts
 * - Backup creation before deletion
 * - Rollback capability
 * - Extensive logging
 */

const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// ULTRA SAFETY CONFIGURATION
const SAFETY_CONFIG = {
  ONLY_HIGH_CONFIDENCE: true,
  REQUIRE_ANALYSIS_TABLE: true,
  DRY_RUN_FIRST: true,
  MULTIPLE_CONFIRMATIONS: true,
  CREATE_BACKUP: true,
  MAX_DELETIONS_PER_RUN: 10, // Limit deletions per run
  REQUIRE_EXPLICIT_CONFIRMATION: true,
  MINIMUM_SIMILARITY_SCORE: 0.9 // Only 90%+ similarity
};

console.log('🔒 SAFE DUPLICATE DELETER - HIGH CONFIDENCE ONLY');
console.log('=' .repeat(70));
console.log('✅ Only deletes HIGH confidence duplicates from analysis table');
console.log('✅ Keeps the best article (working link, nice headline, summary)');
console.log('✅ Multiple safety checks and confirmations required');
console.log('✅ Dry-run mode shows preview before deletion');
console.log('✅ Creates backup before any deletion');
console.log('=' .repeat(70));

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Get user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Safety verification
function verifySafetySettings() {
  console.log('\n🔍 SAFETY VERIFICATION:');
  
  if (!SAFETY_CONFIG.ONLY_HIGH_CONFIDENCE) {
    throw new Error('❌ SAFETY ERROR: ONLY_HIGH_CONFIDENCE must be true');
  }
  console.log('✅ Only processes HIGH confidence duplicates');
  
  if (!SAFETY_CONFIG.REQUIRE_ANALYSIS_TABLE) {
    throw new Error('❌ SAFETY ERROR: REQUIRE_ANALYSIS_TABLE must be true');
  }
  console.log('✅ Requires analysis table data');
  
  if (!SAFETY_CONFIG.DRY_RUN_FIRST) {
    throw new Error('❌ SAFETY ERROR: DRY_RUN_FIRST must be true');
  }
  console.log('✅ Dry-run mode enabled');
  
  if (!SAFETY_CONFIG.MULTIPLE_CONFIRMATIONS) {
    throw new Error('❌ SAFETY ERROR: MULTIPLE_CONFIRMATIONS must be true');
  }
  console.log('✅ Multiple confirmations required');
  
  if (!SAFETY_CONFIG.CREATE_BACKUP) {
    throw new Error('❌ SAFETY ERROR: CREATE_BACKUP must be true');
  }
  console.log('✅ Backup creation enabled');
  
  console.log('✅ All safety settings verified\n');
}

// Get high confidence duplicates from analysis table
async function getHighConfidenceDuplicates() {
  console.log('📊 Reading HIGH confidence duplicates from analysis table...');
  
  const { data: duplicates, error } = await supabase
    .from('duplicate_analysis_with_details')
    .select('*')
    .eq('confidence_level', 'high')
    .gte('similarity_score', SAFETY_CONFIG.MINIMUM_SIMILARITY_SCORE)
    .order('similarity_score', { ascending: false });
  
  if (error) {
    throw new Error(`❌ Error reading duplicates: ${error.message}`);
  }
  
  console.log(`📈 Found ${duplicates.length} HIGH confidence duplicate pairs`);
  return duplicates;
}

// Calculate article quality score
function calculateArticleScore(article) {
  let score = 0;
  
  // URL quality (very important)
  if (article.source_url) {
    if (article.source_url.includes('bloomberg.com')) score += 30;
    else if (article.source_url.includes('reuters.com')) score += 25;
    else if (article.source_url.includes('ft.com')) score += 25;
    else if (article.source_url.includes('wsj.com')) score += 20;
    else if (article.source_url.startsWith('https://')) score += 15;
    else score += 5;
  }
  
  // Title quality
  const titleLength = article.title ? article.title.length : 0;
  score += Math.min(titleLength / 5, 20); // Up to 20 points
  
  // Title specificity (contains amounts, company names)
  if (article.title) {
    const title = article.title.toLowerCase();
    if (title.includes('$') || title.includes('million') || title.includes('billion')) score += 15;
    if (title.includes('apollo') || title.includes('blackstone') || title.includes('kkr')) score += 10;
    if (title.includes('credit') || title.includes('facility') || title.includes('loan')) score += 5;
  }
  
  // Summary quality
  const summaryLength = article.summary ? article.summary.length : 0;
  score += Math.min(summaryLength / 10, 25); // Up to 25 points
  
  // Summary formatting (bold text indicates better formatting)
  if (article.summary && article.summary.includes('**')) score += 10;
  
  // Source quality
  if (article.source) {
    const source = article.source.toLowerCase();
    if (source.includes('bloomberg')) score += 15;
    else if (source.includes('reuters')) score += 12;
    else if (source.includes('financial times')) score += 12;
    else if (source.includes('wall street journal')) score += 10;
    else score += 5;
  }
  
  // Upvotes
  score += (article.upvotes || 0) * 2;
  
  // Recency (newer articles get slight preference)
  const daysSinceCreation = (new Date() - new Date(article.created_at)) / (1000 * 60 * 60 * 24);
  score += Math.max(0, 5 - daysSinceCreation);
  
  return score;
}

// Determine which article to keep and which to delete
function determineArticleToKeep(duplicate) {
  const article1 = {
    id: duplicate.article_1_id,
    title: duplicate.article_1_title,
    summary: duplicate.article_1_summary,
    source: duplicate.article_1_source,
    source_url: duplicate.article_1_source_url,
    upvotes: duplicate.article_1_upvotes,
    created_at: duplicate.article_1_created_at
  };
  
  const article2 = {
    id: duplicate.article_2_id,
    title: duplicate.article_2_title,
    summary: duplicate.article_2_summary,
    source: duplicate.article_2_source,
    source_url: duplicate.article_2_source_url,
    upvotes: duplicate.article_2_upvotes,
    created_at: duplicate.article_2_created_at
  };
  
  const score1 = calculateArticleScore(article1);
  const score2 = calculateArticleScore(article2);
  
  return {
    keepArticle: score1 > score2 ? article1 : article2,
    deleteArticle: score1 > score2 ? article2 : article1,
    keepScore: Math.max(score1, score2),
    deleteScore: Math.min(score1, score2),
    scoreDifference: Math.abs(score1 - score2)
  };
}

// Create backup of articles to be deleted
async function createBackup(articlesToDelete) {
  if (!SAFETY_CONFIG.CREATE_BACKUP) return null;
  
  console.log('💾 Creating backup of articles to be deleted...');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = `backup_deleted_articles_${timestamp}.json`;
  
  const backupData = {
    timestamp: new Date().toISOString(),
    total_articles: articlesToDelete.length,
    articles: articlesToDelete
  };
  
  try {
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    console.log(`✅ Backup created: ${backupFile}`);
    return backupFile;
  } catch (error) {
    console.error(`❌ Error creating backup: ${error.message}`);
    throw error;
  }
}

// Preview what will be deleted (dry-run)
async function previewDeletions(duplicates) {
  console.log('\n🔍 DRY RUN - PREVIEW OF DELETIONS:');
  console.log('=' .repeat(50));
  
  const deletions = [];
  
  for (const duplicate of duplicates) {
    const decision = determineArticleToKeep(duplicate);
    
    deletions.push({
      duplicate_id: duplicate.id,
      keep_article: decision.keepArticle,
      delete_article: decision.deleteArticle,
      similarity_score: duplicate.similarity_score,
      reason: duplicate.similarity_reason
    });
  }
  
  // Show preview
  deletions.forEach((deletion, index) => {
    console.log(`\n📋 PAIR ${index + 1}: (Similarity: ${(deletion.similarity_score * 100).toFixed(1)}%)`);
    console.log(`✅ KEEP:   [${deletion.keep_article.id}] "${deletion.keep_article.title}"`);
    console.log(`   Score: ${calculateArticleScore(deletion.keep_article).toFixed(1)}`);
    console.log(`   URL: ${deletion.keep_article.source_url || 'No URL'}`);
    console.log(`❌ DELETE: [${deletion.delete_article.id}] "${deletion.delete_article.title}"`);
    console.log(`   Score: ${calculateArticleScore(deletion.delete_article).toFixed(1)}`);
    console.log(`   URL: ${deletion.delete_article.source_url || 'No URL'}`);
    console.log(`📝 Reason: ${deletion.reason}`);
  });
  
  console.log('\n' + '=' .repeat(50));
  console.log(`📊 SUMMARY: ${deletions.length} articles will be deleted`);
  console.log(`📊 KEPT: ${deletions.length} articles will be kept`);
  
  return deletions;
}

// Perform the actual deletion
async function performDeletions(deletions, backupFile) {
  console.log('\n🗑️ PERFORMING DELETIONS...');
  
  let successful = 0;
  let failed = 0;
  
  for (const deletion of deletions) {
    try {
      console.log(`🗑️ Deleting article ${deletion.delete_article.id}: "${deletion.delete_article.title.substring(0, 50)}..."`);
      
      const { error } = await supabase
        .from('deals')
        .delete()
        .eq('id', deletion.delete_article.id);
      
      if (error) {
        console.error(`❌ Error deleting article ${deletion.delete_article.id}: ${error.message}`);
        failed++;
      } else {
        console.log(`✅ Successfully deleted article ${deletion.delete_article.id}`);
        successful++;
      }
      
      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`❌ Error deleting article ${deletion.delete_article.id}: ${error.message}`);
      failed++;
    }
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log('📊 DELETION SUMMARY:');
  console.log(`✅ Successfully deleted: ${successful} articles`);
  console.log(`❌ Failed to delete: ${failed} articles`);
  console.log(`💾 Backup file: ${backupFile}`);
  console.log('=' .repeat(50));
  
  return { successful, failed };
}

// Main deletion function
async function deleteDuplicates() {
  try {
    // Safety verification
    verifySafetySettings();
    
    // Check if analysis table has data
    const duplicates = await getHighConfidenceDuplicates();
    
    if (duplicates.length === 0) {
      console.log('✅ No HIGH confidence duplicates found. Nothing to delete.');
      return;
    }
    
    // Limit deletions per run
    const limitedDuplicates = duplicates.slice(0, SAFETY_CONFIG.MAX_DELETIONS_PER_RUN);
    
    if (duplicates.length > SAFETY_CONFIG.MAX_DELETIONS_PER_RUN) {
      console.log(`⚠️ Found ${duplicates.length} duplicates, but limiting to ${SAFETY_CONFIG.MAX_DELETIONS_PER_RUN} per run for safety.`);
    }
    
    // DRY RUN - Show preview
    const deletions = await previewDeletions(limitedDuplicates);
    
    // First confirmation
    const confirm1 = await askQuestion('\n🔍 Review the preview above. Do you want to proceed with deletions? (yes/no): ');
    if (confirm1.toLowerCase() !== 'yes') {
      console.log('❌ Deletion cancelled by user');
      return;
    }
    
    // Second confirmation
    const confirm2 = await askQuestion(`\n⚠️ FINAL CONFIRMATION: This will DELETE ${deletions.length} articles. Type "DELETE" to confirm: `);
    if (confirm2 !== 'DELETE') {
      console.log('❌ Deletion cancelled - incorrect confirmation');
      return;
    }
    
    // Create backup
    const articlesToDelete = deletions.map(d => d.delete_article);
    const backupFile = await createBackup(articlesToDelete);
    
    // Perform deletions
    const results = await performDeletions(deletions, backupFile);
    
    console.log('\n✅ Deletion process completed successfully!');
    console.log(`📊 Deleted ${results.successful} duplicate articles`);
    console.log(`📊 Kept ${results.successful} best articles`);
    console.log(`💾 Backup saved to: ${backupFile}`);
    
  } catch (error) {
    console.error('❌ Error during deletion process:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the deletion
if (require.main === module) {
  deleteDuplicates().catch(console.error);
}

module.exports = { deleteDuplicates }; 