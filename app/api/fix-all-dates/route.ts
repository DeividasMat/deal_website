import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { DateValidator } from '@/lib/date-validator';

export async function POST(request: NextRequest) {
  try {
    const { preview = false } = await request.json().catch(() => ({}));
    
    console.log('🔍 Starting comprehensive database article date fixing...');
    
    const db = getDatabase();
    const dateValidator = new DateValidator();
    
    // Get all articles from database
    const allArticles = await db.getAllDeals();
    console.log(`📊 Found ${allArticles.length} total articles in database`);
    
    // Filter articles that need date fixing
    const articlesToFix = allArticles.filter(article => needsDateFix(article));
    console.log(`⚠️  Found ${articlesToFix.length} articles that need date fixing`);
    
    if (articlesToFix.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All articles already have correct dates!',
        fixed: 0,
        total: allArticles.length
      });
    }
    
    if (preview) {
      // Preview mode - show what would be processed
      return NextResponse.json({
        success: true,
        preview: true,
        articlesToFix: articlesToFix.slice(0, 20).map(article => ({
          id: article.id,
          title: article.title.substring(0, 60) + '...',
          currentDate: article.date,
          needsFixing: true
        })),
        totalFound: articlesToFix.length,
        totalArticles: allArticles.length
      });
    }
    
    let fixed = 0;
    let failed = 0;
    let skipped = 0;
    
    // Process articles in batches of 5 to avoid overwhelming APIs
    const batchSize = 5;
    for (let i = 0; i < articlesToFix.length; i += batchSize) {
      const batch = articlesToFix.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(articlesToFix.length/batchSize)} (${batch.length} articles)`);
      
      const promises = batch.map(async (article) => {
        try {
          if (!article.id) {
            console.error(`   ❌ Article missing ID: "${article.title?.substring(0, 50)}..."`);
            failed++;
            return;
          }
          
          console.log(`🔍 Processing: "${article.title?.substring(0, 50)}..." (ID: ${article.id})`);
          console.log(`   Current date: ${article.date}`);
          
          // Use the date validator to get the correct date
          const correctedDate = await dateValidator.validateArticleDate(
            article.title || '',
            article.summary || '',
            article.content || '',
            article.source_url,
            article.date
          );
          
          console.log(`   Corrected date: ${correctedDate}`);
          
          // Check if the date actually changed
          if (correctedDate === article.date) {
            console.log(`   ⏭️  No change needed for article ${article.id}`);
            skipped++;
            return;
          }
          
          // Update the article in the database
          await db.updateDealDate(article.id, correctedDate);
          console.log(`   ✅ Updated article ${article.id} from ${article.date} to ${correctedDate}`);
          fixed++;
          
        } catch (error) {
          console.error(`   ❌ Failed to process article ${article.id}:`, error);
          failed++;
        }
      });
      
      await Promise.all(promises);
      
      // Add delay to avoid overwhelming APIs
      if (i + batchSize < articlesToFix.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log('📊 Final Results:');
    console.log(`✅ Fixed: ${fixed} articles`);
    console.log(`❌ Failed: ${failed} articles`);
    console.log(`⏭️  Skipped: ${skipped} articles`);
    
    return NextResponse.json({
      success: true,
      message: 'Date fixing completed successfully',
      fixed,
      failed,
      skipped,
      total: articlesToFix.length,
      totalArticles: allArticles.length
    });
    
  } catch (error) {
    console.error('❌ Error during article date fixing:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Date fixing failed'
    }, { status: 500 });
  }
}

function needsDateFix(article: any): boolean {
  const articleDate = new Date(article.date);
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);
  
  // Check if date is invalid, in the future, or too old
  if (isNaN(articleDate.getTime())) {
    return true; // Invalid date
  }
  
  if (articleDate > today) {
    return true; // Future date
  }
  
  if (articleDate < thirtyDaysAgo) {
    return true; // Too old (more than 30 days ago)
  }
  
  return false;
} 