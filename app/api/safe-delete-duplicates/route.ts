import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ULTRA SAFETY CONFIGURATION
const SAFETY_CONFIG = {
  ONLY_HIGH_CONFIDENCE: true,
  REQUIRE_ANALYSIS_TABLE: true,
  MAX_DELETIONS_PER_REQUEST: 5, // Even more limited for API
  MINIMUM_SIMILARITY_SCORE: 0.9, // Only 90%+ similarity
  REQUIRE_CONFIRMATION_TOKEN: true
};

// Calculate article quality score
function calculateArticleScore(article: any): number {
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
  const daysSinceCreation = (new Date().getTime() - new Date(article.created_at).getTime()) / (1000 * 60 * 60 * 24);
  score += Math.max(0, 5 - daysSinceCreation);
  
  return score;
}

// Determine which article to keep and which to delete
function determineArticleToKeep(duplicate: any) {
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

// Get high confidence duplicates
async function getHighConfidenceDuplicates() {
  const { data: duplicates, error } = await supabase
    .from('duplicate_analysis_with_details')
    .select('*')
    .eq('confidence_level', 'high')
    .gte('similarity_score', SAFETY_CONFIG.MINIMUM_SIMILARITY_SCORE)
    .order('similarity_score', { ascending: false });
  
  if (error) {
    throw new Error(`❌ Error reading duplicates: ${error.message}`);
  }
  
  return duplicates;
}

// DRY RUN - Preview what will be deleted
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 DRY RUN - Previewing high confidence duplicates for deletion');
    
    // Safety verification
    if (!SAFETY_CONFIG.ONLY_HIGH_CONFIDENCE) {
      throw new Error('❌ SAFETY ERROR: ONLY_HIGH_CONFIDENCE must be true');
    }
    
    const duplicates = await getHighConfidenceDuplicates();
    
    if (duplicates.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No high confidence duplicates found',
        preview: [],
        total_pairs: 0
      });
    }
    
    // Limit for safety
    const limitedDuplicates = duplicates.slice(0, SAFETY_CONFIG.MAX_DELETIONS_PER_REQUEST);
    
    const deletions = limitedDuplicates.map((duplicate) => {
      const decision = determineArticleToKeep(duplicate);
      
      return {
        duplicate_id: duplicate.id,
        similarity_score: duplicate.similarity_score,
        confidence_level: duplicate.confidence_level,
        reason: duplicate.similarity_reason,
        keep_article: {
          id: decision.keepArticle.id,
          title: decision.keepArticle.title,
          source_url: decision.keepArticle.source_url,
          score: calculateArticleScore(decision.keepArticle)
        },
        delete_article: {
          id: decision.deleteArticle.id,
          title: decision.deleteArticle.title,
          source_url: decision.deleteArticle.source_url,
          score: calculateArticleScore(decision.deleteArticle)
        }
      };
    });
    
    return NextResponse.json({
      success: true,
      message: `Found ${duplicates.length} high confidence duplicates`,
      preview: deletions,
      total_pairs: duplicates.length,
      limited_to: SAFETY_CONFIG.MAX_DELETIONS_PER_REQUEST,
      safety_note: 'This is a DRY RUN - no articles will be deleted'
    });
    
  } catch (error) {
    console.error('❌ Error in duplicate deletion preview:', error);
    return NextResponse.json({
      success: false,
      error: 'Preview failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// ACTUAL DELETION - Only with proper confirmation
export async function POST(request: NextRequest) {
  try {
    console.log('🔒 SAFE DELETE - Processing high confidence duplicates');
    
    const { confirmationToken, dryRun = true } = await request.json();
    
    // Safety verification
    if (!SAFETY_CONFIG.ONLY_HIGH_CONFIDENCE) {
      throw new Error('❌ SAFETY ERROR: ONLY_HIGH_CONFIDENCE must be true');
    }
    
    // Require confirmation token for actual deletion
    if (!dryRun && confirmationToken !== 'DELETE_HIGH_CONFIDENCE_DUPLICATES') {
      return NextResponse.json({
        success: false,
        error: 'Invalid confirmation token',
        message: 'Must provide confirmationToken: "DELETE_HIGH_CONFIDENCE_DUPLICATES" for actual deletion'
      }, { status: 400 });
    }
    
    const duplicates = await getHighConfidenceDuplicates();
    
    if (duplicates.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No high confidence duplicates found',
        results: {
          deleted: 0,
          kept: 0,
          failed: 0
        }
      });
    }
    
    // Limit for safety
    const limitedDuplicates = duplicates.slice(0, SAFETY_CONFIG.MAX_DELETIONS_PER_REQUEST);
    
    const deletions = limitedDuplicates.map((duplicate) => {
      const decision = determineArticleToKeep(duplicate);
      return {
        duplicate_id: duplicate.id,
        keep_article: decision.keepArticle,
        delete_article: decision.deleteArticle,
        similarity_score: duplicate.similarity_score,
        reason: duplicate.similarity_reason
      };
    });
    
    // If dry run, return preview
    if (dryRun) {
      return NextResponse.json({
        success: true,
        message: 'DRY RUN - Preview of deletions',
        preview: deletions.map(d => ({
          keep: { id: d.keep_article.id, title: d.keep_article.title },
          delete: { id: d.delete_article.id, title: d.delete_article.title },
          similarity: d.similarity_score,
          reason: d.reason
        })),
        total_to_delete: deletions.length,
        safety_note: 'This is a DRY RUN - no articles were deleted'
      });
    }
    
    // ACTUAL DELETION PROCESS
    console.log(`🗑️ PERFORMING ACTUAL DELETION of ${deletions.length} duplicates`);
    
    let successful = 0;
    let failed = 0;
    const deletionResults = [];
    
    for (const deletion of deletions) {
      try {
        console.log(`🗑️ Deleting article ${deletion.delete_article.id}: "${deletion.delete_article.title}"`);
        
        const { error } = await supabase
          .from('deals')
          .delete()
          .eq('id', deletion.delete_article.id);
        
        if (error) {
          console.error(`❌ Error deleting article ${deletion.delete_article.id}: ${error.message}`);
          failed++;
          deletionResults.push({
            article_id: deletion.delete_article.id,
            status: 'failed',
            error: error.message
          });
        } else {
          console.log(`✅ Successfully deleted article ${deletion.delete_article.id}`);
          successful++;
          deletionResults.push({
            article_id: deletion.delete_article.id,
            status: 'deleted',
            kept_article_id: deletion.keep_article.id
          });
        }
        
        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Error deleting article ${deletion.delete_article.id}: ${error}`);
        failed++;
        deletionResults.push({
          article_id: deletion.delete_article.id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Duplicate deletion completed',
      results: {
        deleted: successful,
        kept: successful,
        failed: failed,
        total_processed: deletions.length,
        deletion_details: deletionResults
      },
      safety_note: 'Only high confidence duplicates were deleted'
    });
    
  } catch (error) {
    console.error('❌ Error in safe duplicate deletion:', error);
    return NextResponse.json({
      success: false,
      error: 'Deletion failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 