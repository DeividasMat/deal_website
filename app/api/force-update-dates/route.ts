import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { preview = false } = await request.json().catch(() => ({}));
    
    console.log('🔍 Force updating all articles with 2025-07-14 to 2025-07-15...');
    
    const db = getDatabase();
    const targetDate = '2025-07-15';
    const oldDate = '2025-07-14';
    
    // Get all articles from database
    const allArticles = await db.getAllDeals();
    console.log(`📊 Found ${allArticles.length} total articles in database`);
    
    // Filter articles with the old date
    const articlesToUpdate = allArticles.filter(article => {
      return article.date === oldDate;
    });
    
    console.log(`⚠️  Found ${articlesToUpdate.length} articles with date ${oldDate}`);
    
    if (preview) {
      return NextResponse.json({
        message: 'Preview mode',
        oldDate,
        targetDate,
        totalArticles: allArticles.length,
        articlesToUpdate: articlesToUpdate.length,
        sampleArticles: articlesToUpdate.slice(0, 5).map(a => ({
          id: a.id,
          title: a.title?.substring(0, 50) + '...',
          currentDate: a.date
        }))
      });
    }
    
    // Update articles to target date
    let updated = 0;
    let failed = 0;
    
    for (const article of articlesToUpdate) {
      try {
        if (!article.id) {
          failed++;
          console.error(`❌ Article has no ID, skipping`);
          continue;
        }
        await db.updateDealDate(article.id, targetDate);
        updated++;
        console.log(`✅ Updated article ${article.id} from ${oldDate} to ${targetDate}`);
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
      oldDate,
      targetDate,
      totalArticles: allArticles.length,
      articlesToUpdate: articlesToUpdate.length,
      updated,
      failed
    });
    
  } catch (error) {
    console.error('Error updating articles:', error);
    return NextResponse.json({ error: 'Failed to update articles' }, { status: 500 });
  }
} 