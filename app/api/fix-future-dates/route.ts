import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { preview = false } = await request.json().catch(() => ({}));
    
    console.log('🔍 Finding and fixing future-dated articles...');
    
    const db = getDatabase();
    const today = '2025-07-14'; // Today's date
    
    // Get all articles from database
    const allArticles = await db.getAllDeals();
    console.log(`📊 Found ${allArticles.length} total articles in database`);
    
    // Filter articles with future dates (after today)
    const futureArticles = allArticles.filter(article => {
      const articleDate = new Date(article.date);
      const todayDate = new Date(today);
      return articleDate > todayDate;
    });
    
    console.log(`⚠️  Found ${futureArticles.length} articles with future dates`);
    
    if (futureArticles.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No future-dated articles found!',
        fixed: 0,
        total: allArticles.length
      });
    }
    
    if (preview) {
      return NextResponse.json({
        success: true,
        preview: true,
        futureArticles: futureArticles.map(article => ({
          id: article.id,
          title: article.title.substring(0, 60) + '...',
          currentDate: article.date,
          willBeSetTo: today
        })),
        totalFound: futureArticles.length
      });
    }
    
    let fixed = 0;
    let failed = 0;
    
    // Fix each future-dated article
    for (const article of futureArticles) {
      try {
        if (!article.id) {
          console.error(`❌ Article missing ID: "${article.title?.substring(0, 50)}..."`);
          failed++;
          continue;
        }
        
        console.log(`🔍 Fixing: "${article.title?.substring(0, 50)}..." (ID: ${article.id})`);
        console.log(`   Future date: ${article.date} → Today: ${today}`);
        
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
      message: 'Future date fixing completed successfully',
      fixed,
      failed,
      total: futureArticles.length
    });
    
  } catch (error) {
    console.error('❌ Error during future date fixing:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Future date fixing failed'
    }, { status: 500 });
  }
} 