import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { preview = false } = await request.json().catch(() => ({}));
    
    console.log('🔍 Fixing articles with impossible December 2025 dates...');
    
    const db = getDatabase();
    const today = '2025-07-14';
    
    // Get all articles from database
    const allArticles = await db.getAllDeals();
    console.log(`📊 Found ${allArticles.length} total articles in database`);
    
    // Filter articles with December 2025 dates (2025-12-*)
    const decemberArticles = allArticles.filter(article => {
      return article.date && article.date.startsWith('2025-12-');
    });
    
    console.log(`⚠️  Found ${decemberArticles.length} articles with impossible December 2025 dates`);
    
    if (decemberArticles.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No December 2025 articles found!',
        fixed: 0,
        total: allArticles.length
      });
    }
    
    if (preview) {
      return NextResponse.json({
        success: true,
        preview: true,
        decemberArticles: decemberArticles.map(article => ({
          id: article.id,
          title: article.title.substring(0, 60) + '...',
          currentDate: article.date,
          willBeSetTo: today
        })),
        totalFound: decemberArticles.length
      });
    }
    
    let fixed = 0;
    let failed = 0;
    
    // Fix each December article
    for (const article of decemberArticles) {
      try {
        if (!article.id) {
          console.error(`❌ Article missing ID: "${article.title?.substring(0, 50)}..."`);
          failed++;
          continue;
        }
        
        console.log(`🔍 Fixing: "${article.title?.substring(0, 50)}..." (ID: ${article.id})`);
        console.log(`   December date: ${article.date} → Today: ${today}`);
        
        // Update the article to today's date
        await db.updateDealDate(article.id, today);
        console.log(`   ✅ Updated article ${article.id} to ${today}`);
        fixed++;
        
      } catch (error) {
        console.error(`❌ Failed to fix article ${article.id}:`, error);
        failed++;
      }
    }
    
    console.log('📊 Final Results:');
    console.log(`✅ Fixed: ${fixed} articles`);
    console.log(`❌ Failed: ${failed} articles`);
    
    return NextResponse.json({
      success: true,
      message: 'December date fixing completed successfully',
      fixed,
      failed,
      total: decemberArticles.length
    });
    
  } catch (error) {
    console.error('❌ Error during December date fixing:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'December date fixing failed'
    }, { status: 500 });
  }
} 