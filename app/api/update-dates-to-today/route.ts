import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { format } from 'date-fns';

export async function POST(request: NextRequest) {
  try {
    const { preview = false } = await request.json().catch(() => ({}));
    
    console.log('🔍 Updating articles from yesterday to today...');
    
    const db = getDatabase();
    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(new Date(Date.now() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
    
    console.log(`📅 Today: ${today}`);
    console.log(`📅 Yesterday: ${yesterday}`);
    
    // Get all articles from database
    const allArticles = await db.getAllDeals();
    console.log(`📊 Found ${allArticles.length} total articles in database`);
    
    // Filter articles with yesterday's date
    const yesterdayArticles = allArticles.filter(article => {
      return article.date === yesterday;
    });
    
    console.log(`⚠️  Found ${yesterdayArticles.length} articles with yesterday's date (${yesterday})`);
    
    if (preview) {
      return NextResponse.json({
        message: 'Preview mode',
        today,
        yesterday,
        totalArticles: allArticles.length,
        yesterdayArticles: yesterdayArticles.length,
        articleSamples: yesterdayArticles.slice(0, 5).map(a => ({
          id: a.id,
          title: a.title?.substring(0, 50) + '...',
          currentDate: a.date
        }))
      });
    }
    
    // Update articles to today's date
    let updated = 0;
    let failed = 0;
    
    for (const article of yesterdayArticles) {
      try {
        if (!article.id) {
          failed++;
          console.error(`❌ Article has no ID, skipping`);
          continue;
        }
        await db.updateDealDate(article.id, today);
        updated++;
        console.log(`✅ Updated article ${article.id} to ${today}`);
      } catch (error) {
        failed++;
        console.error(`❌ Failed to update article ${article.id}:`, error);
      }
    }
    
    console.log(`📊 Final Results:`);
    console.log(`✅ Updated: ${updated} articles`);
    console.log(`❌ Failed: ${failed} articles`);
    
    return NextResponse.json({
      message: 'Articles updated successfully',
      today,
      yesterday,
      totalArticles: allArticles.length,
      yesterdayArticles: yesterdayArticles.length,
      updated,
      failed
    });
    
  } catch (error) {
    console.error('Error updating articles:', error);
    return NextResponse.json({ error: 'Failed to update articles' }, { status: 500 });
  }
} 