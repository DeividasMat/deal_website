import { NextRequest, NextResponse } from 'next/server';
import { getScheduler } from '@/lib/scheduler';
import { format, subHours } from 'date-fns';
import { getDatabase } from '@/lib/database';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Track last fetch time in memory
let lastFetchTime: Date | null = null;
let isFetching = false;

export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    
    // Check if we should fetch new data
    const shouldFetch = !lastFetchTime || 
                       (now.getTime() - lastFetchTime.getTime()) > (3 * 60 * 60 * 1000); // 3 hours
    
    if (shouldFetch && !isFetching) {
      console.log('🤖 Auto-fetch: Time to fetch new data');
      
      // Don't wait for fetch to complete, return immediately
      triggerBackgroundFetch();
      
      return NextResponse.json({
        status: 'fetching',
        message: 'Background fetch initiated',
        lastFetch: lastFetchTime?.toISOString(),
        nextFetch: new Date(now.getTime() + (3 * 60 * 60 * 1000)).toISOString()
      });
    }
    
    // Get current database stats
    const db = getDatabase();
    const allDeals = await db.getAllDeals();
    const todayDeals = allDeals.filter(deal => 
      deal.date === format(now, 'yyyy-MM-dd')
    );
    
    return NextResponse.json({
      status: isFetching ? 'fetching' : 'idle',
      lastFetch: lastFetchTime?.toISOString(),
      nextFetch: lastFetchTime ? 
        new Date(lastFetchTime.getTime() + (3 * 60 * 60 * 1000)).toISOString() : 
        'Now',
      stats: {
        totalDeals: allDeals.length,
        todayDeals: todayDeals.length,
        lastDealDate: allDeals[0]?.date
      }
    });
    
  } catch (error) {
    console.error('❌ Auto-fetch error:', error);
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function triggerBackgroundFetch() {
  if (isFetching) return;
  
  isFetching = true;
  
  try {
    console.log('🚀 Starting background news fetch...');
    
    const scheduler = getScheduler();
    const today = format(new Date(), 'yyyy-MM-dd');
    
    // Fetch news for today
    await scheduler.fetchAndProcessDeals(today);
    
    lastFetchTime = new Date();
    console.log('✅ Background fetch completed at', lastFetchTime.toISOString());
    
  } catch (error) {
    console.error('❌ Background fetch failed:', error);
  } finally {
    isFetching = false;
  }
}

export async function POST(request: NextRequest) {
  // Manual trigger for immediate fetch
  try {
    if (isFetching) {
      return NextResponse.json({
        status: 'already_fetching',
        message: 'A fetch is already in progress'
      });
    }
    
    await triggerBackgroundFetch();
    
    return NextResponse.json({
      status: 'success',
      message: 'Manual fetch completed',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}



