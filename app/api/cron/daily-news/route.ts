import { NextRequest, NextResponse } from 'next/server';
import { getScheduler } from '@/lib/scheduler';
import { format, subDays } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    console.log('🕐 Vercel Cron: Starting daily news collection...');
    console.log('🕐 Cron triggered at:', new Date().toISOString());
    
    // Check environment variables
    const hasSecret = !!process.env.CRON_SECRET;
    const hasPerplexity = !!process.env.PERPLEXITY_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    const isVercel = !!process.env.VERCEL;
    
    console.log('Environment check:', { hasSecret, hasPerplexity, hasOpenAI, hasSupabase, isVercel });
    
    // For Vercel cron jobs, skip CRON_SECRET verification (Vercel handles authentication)
    // For manual/external calls, verify CRON_SECRET if it's set
    if (hasSecret && !isVercel) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        console.log('❌ Unauthorized: Invalid or missing authorization header');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      console.log('✅ Authorization verified');
    } else if (isVercel) {
      console.log('✅ Vercel cron - using built-in authentication');
    } else {
      console.log('⚠️ No CRON_SECRET set - running without authorization');
    }
    
    if (!hasPerplexity || !hasOpenAI || !hasSupabase) {
      console.log('❌ Missing required environment variables');
      return NextResponse.json({ 
        error: 'Missing required environment variables',
        missing: {
          perplexity: !hasPerplexity,
          openai: !hasOpenAI,
          supabase: !hasSupabase
        }
      }, { status: 500 });
    }

    // Calculate the date to fetch news for (current day)
    const today = new Date();
    const targetDate = format(today, 'yyyy-MM-dd');
    
    console.log('📅 Fetching news for date:', targetDate);
    
    // Get scheduler and run news collection
    const scheduler = getScheduler();
    
    console.log('📰 Starting news fetch...');
    await scheduler.fetchAndProcessDeals(targetDate);
    console.log('✅ News fetch completed');
    
    // Clean up duplicates after fetching
    console.log('🧹 Cleaning up duplicate articles...');
    const duplicatesRemoved = await scheduler.runDuplicateCleanup();
    console.log(`🗑️ Removed ${duplicatesRemoved} duplicate articles`);
    
    console.log('✅ Daily news collection completed');
    
    return NextResponse.json({
      success: true,
      message: 'Daily news collection completed',
      date: targetDate,
      duplicatesRemoved,
      timestamp: new Date().toISOString(),
      executionTime: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      trigger: 'vercel-cron'
    });
    
  } catch (error) {
    console.error('❌ Daily cron error:', error);
    return NextResponse.json({
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