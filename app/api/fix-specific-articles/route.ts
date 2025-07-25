import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { articleIds, newDate } = await request.json();
    
    console.log('🔍 Fixing specific articles by ID...');
    
    const db = getDatabase();
    const targetDate = newDate || '2025-07-14';
    
    // Default to the specific December articles if no IDs provided
    const idsToFix = articleIds || [458, 206, 4];
    
    console.log(`⚠️  Fixing ${idsToFix.length} specific articles`);
    
    let fixed = 0;
    let failed = 0;
    
    // Fix each article by ID
    for (const articleId of idsToFix) {
      try {
        console.log(`🔍 Fixing article ID: ${articleId}`);
        
        // Update the article to the target date
        await db.updateDealDate(articleId, targetDate);
        console.log(`   ✅ Updated article ${articleId} to ${targetDate}`);
        fixed++;
        
      } catch (error) {
        console.error(`❌ Failed to fix article ${articleId}:`, error);
        failed++;
      }
    }
    
    console.log('📊 Final Results:');
    console.log(`✅ Fixed: ${fixed} articles`);
    console.log(`❌ Failed: ${failed} articles`);
    
    return NextResponse.json({
      success: true,
      message: 'Specific article fixing completed successfully',
      fixed,
      failed,
      total: idsToFix.length,
      articlesFixed: idsToFix,
      newDate: targetDate
    });
    
  } catch (error) {
    console.error('❌ Error during specific article fixing:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Specific article fixing failed'
    }, { status: 500 });
  }
} 