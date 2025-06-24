import { NextRequest, NextResponse } from 'next/server';
import { getScheduler } from '@/lib/scheduler';
import { format, subDays } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    console.log('🕐 Vercel Cron: Starting daily news collection...');
    
    // Verify this is actually a cron request (basic security)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log('❌ Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const scheduler = getScheduler();
    
    // Get yesterday's date for news collection
    const yesterday = subDays(new Date(), 1);
    const dateStr = format(yesterday, 'yyyy-MM-dd');
    
    console.log(`📅 Collecting news for: ${dateStr}`);
    
    // Fetch news for yesterday
    await scheduler.fetchAndProcessDeals(dateStr);
    
    // Clean up duplicates after fetching
    console.log('🧹 Cleaning up duplicate articles...');
    const duplicatesRemoved = await scheduler.runDuplicateCleanup();
    
    console.log(`✅ Daily cron completed successfully`);
    console.log(`🗑️ Removed ${duplicatesRemoved} duplicate articles`);
    
    return NextResponse.json({
      success: true,
      message: 'Daily news collection completed',
      date: dateStr,
      duplicatesRemoved,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error in daily cron job:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Daily news collection failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
} 