import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { format, subDays } from 'date-fns';

export async function POST(request: NextRequest) {
  try {
    const { preview = false } = await request.json().catch(() => ({}));
    
    console.log('🔍 Starting critical date fixing for obviously wrong dates...');
    
    const db = getDatabase();
    
    // Get all articles from database
    const allArticles = await db.getAllDeals();
    console.log(`📊 Found ${allArticles.length} total articles in database`);
    
    // Filter articles that have critical date issues
    const articlesToFix = allArticles.filter(article => hasCriticalDateIssue(article));
    console.log(`⚠️  Found ${articlesToFix.length} articles with critical date issues`);
    
    if (articlesToFix.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All articles have reasonable dates!',
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
          issue: getDateIssue(article.date),
          proposedDate: getReasonableDate(article.date)
        })),
        totalFound: articlesToFix.length,
        totalArticles: allArticles.length
      });
    }
    
    let fixed = 0;
    let failed = 0;
    
    for (const article of articlesToFix) {
      try {
        if (!article.id) {
          console.error(`❌ Article missing ID: "${article.title?.substring(0, 50)}..."`);
          failed++;
          continue;
        }
        
        const currentDate = article.date;
        const newDate = getReasonableDate(currentDate);
        
        console.log(`🔍 Processing: "${article.title?.substring(0, 50)}..." (ID: ${article.id})`);
        console.log(`   Current date: ${currentDate} (${getDateIssue(currentDate)})`);
        console.log(`   New date: ${newDate}`);
        
        // Update the article in the database
        await db.updateDealDate(article.id, newDate);
        console.log(`   ✅ Updated article ${article.id} from ${currentDate} to ${newDate}`);
        fixed++;
        
      } catch (error) {
        console.error(`❌ Failed to process article ${article.id}:`, error);
        failed++;
      }
    }
    
    console.log('📊 Final Results:');
    console.log(`✅ Fixed: ${fixed} articles`);
    console.log(`❌ Failed: ${failed} articles`);
    
    return NextResponse.json({
      success: true,
      message: 'Critical date fixing completed successfully',
      fixed,
      failed,
      total: articlesToFix.length,
      totalArticles: allArticles.length
    });
    
  } catch (error) {
    console.error('❌ Error during critical date fixing:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Critical date fixing failed'
    }, { status: 500 });
  }
}

function hasCriticalDateIssue(article: any): boolean {
  const articleDate = new Date(article.date);
  const today = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(today.getFullYear() - 1);
  
  // Check if date is invalid, in the future, or very old
  if (isNaN(articleDate.getTime())) {
    return true; // Invalid date
  }
  
  if (articleDate > today) {
    return true; // Future date
  }
  
  if (articleDate < oneYearAgo) {
    return true; // Too old (more than 1 year ago)
  }
  
  return false;
}

function getDateIssue(dateString: string): string {
  const articleDate = new Date(dateString);
  const today = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(today.getFullYear() - 1);
  
  if (isNaN(articleDate.getTime())) {
    return 'Invalid date';
  }
  
  if (articleDate > today) {
    return 'Future date';
  }
  
  if (articleDate < oneYearAgo) {
    return 'Too old (>1 year)';
  }
  
  return 'Unknown issue';
}

function getReasonableDate(currentDate: string): string {
  const today = new Date();
  const articleDate = new Date(currentDate);
  
  // For future dates, set to today
  if (articleDate > today) {
    return format(today, 'yyyy-MM-dd');
  }
  
  // For very old dates, set to a few days ago to spread them out
  const daysAgo = Math.floor(Math.random() * 7) + 1; // 1-7 days ago
  const newDate = subDays(today, daysAgo);
  return format(newDate, 'yyyy-MM-dd');
} 