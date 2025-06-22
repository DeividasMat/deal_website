import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { getScheduler } from '@/lib/scheduler';
import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const dateRange = searchParams.get('dateRange');
    const category = searchParams.get('category');
    
    const db = getDatabase();
    
    if (dateRange) {
      // Handle date range filtering
      const today = new Date();
      let startDate: string, endDate: string;
      
      switch (dateRange) {
        case 'today':
          startDate = endDate = format(today, 'yyyy-MM-dd');
          break;
        case 'yesterday':
          const yesterday = subDays(today, 1);
          startDate = endDate = format(yesterday, 'yyyy-MM-dd');
          break;
        case 'week':
          startDate = format(startOfWeek(today), 'yyyy-MM-dd');
          endDate = format(endOfWeek(today), 'yyyy-MM-dd');
          break;
        case 'month':
          startDate = format(startOfMonth(today), 'yyyy-MM-dd');
          endDate = format(endOfMonth(today), 'yyyy-MM-dd');
          break;
        default:
          startDate = format(subDays(today, 7), 'yyyy-MM-dd');
          endDate = format(today, 'yyyy-MM-dd');
      }
      
      const deals = await db.getDealsByDateRange(startDate, endDate);
      return NextResponse.json({ deals, startDate, endDate });
    } else if (category) {
      // Get deals by category
      const deals = await db.getDealsByCategory(category, 50); // Increased limit
      return NextResponse.json({ deals, category });
    } else if (date) {
      // Get deals for specific date
      const deals = await db.getDealsByDate(date);
      return NextResponse.json({ deals, date });
    } else {
      // Get all available dates
      const dates = await db.getAvailableDates();
      return NextResponse.json({ dates });
    }
  } catch (error) {
    console.error('Error fetching deals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deals' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, date, articleId, dateRange } = body;
    
    if (action === 'cleanup') {
      const db = getDatabase();
      const deletedCount = await db.cleanupInvalidArticles();
      
      return NextResponse.json({ 
        success: true, 
        message: `Cleaned up ${deletedCount} invalid articles`,
        deletedCount: deletedCount
      });
    } else if (action === 'manual_cleanup') {
      const scheduler = getScheduler();
      const deletedCount = await scheduler.runDuplicateCleanup();
      
      return NextResponse.json({ 
        success: true, 
        message: `Removed ${deletedCount} duplicate articles`,
        deletedCount: deletedCount
      });
    } else if (action === 'fetch') {
      const scheduler = getScheduler();
      
      if (dateRange === 'week') {
        // Bulk fetch for week
        const today = new Date();
        const startDate = startOfWeek(today);
        const endDate = endOfWeek(today);
        
        // Get all dates in the range
        const datesInRange = eachDayOfInterval({ start: startDate, end: endDate });
        const dateStrings = datesInRange.map(d => format(d, 'yyyy-MM-dd'));
        
        console.log(`Bulk fetching for week: ${dateStrings.length} dates`);
        
        let totalNewDeals = 0;
        const results = [];
        
        // Fetch news for each date
        for (const dateStr of dateStrings) {
          try {
            console.log(`Fetching news for ${dateStr}...`);
            await scheduler.runManualFetch(dateStr);
            
            // Get the newly fetched deals for this date
            const db = getDatabase();
            const dealsForDate = await db.getDealsByDate(dateStr);
            totalNewDeals += dealsForDate.length;
            results.push({ date: dateStr, count: dealsForDate.length });
            
            // Small delay between requests to avoid overwhelming APIs
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (error) {
            console.error(`Error fetching for ${dateStr}:`, error);
            results.push({ date: dateStr, count: 0, error: error instanceof Error ? error.message : 'Unknown error' });
          }
        }
        
        // Get all deals in the range
        const db = getDatabase();
        const allDeals = await db.getDealsByDateRange(
          format(startDate, 'yyyy-MM-dd'),
          format(endDate, 'yyyy-MM-dd')
        );
        
        return NextResponse.json({ 
          success: true, 
          message: `Bulk fetch completed for week`,
          deals: allDeals,
          totalDeals: allDeals.length,
          newDeals: totalNewDeals,
          results: results,
          dateRange: 'week'
        });
      } else {
        // Single date fetch
        const targetDate = date || format(subDays(new Date(), 1), 'yyyy-MM-dd');
        
        // Run manual fetch
        await scheduler.runManualFetch(targetDate);
        
        // Get the newly fetched deals
        const db = getDatabase();
        const deals = await db.getDealsByDate(targetDate);
        
        return NextResponse.json({ 
          success: true, 
          message: 'News fetched successfully',
          deals,
          date: targetDate
        });
      }
    } else if (action === 'upvote' && articleId) {
      // Handle upvoting
      const userIp = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    '127.0.0.1';
      
      const db = getDatabase();
      const success = await db.upvoteArticle(articleId, userIp);
      
      if (success) {
        return NextResponse.json({ 
          success: true, 
          message: 'Vote recorded successfully' 
        });
      } else {
        return NextResponse.json({ 
          success: false, 
          message: 'You have already voted for this article' 
        }, { status: 400 });
      }
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in POST /api/deals:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
} 