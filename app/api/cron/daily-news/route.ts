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
    
    console.log('Environment check:', { hasSecret, hasPerplexity, hasOpenAI, hasSupabase });
    
    // Verify this is actually a cron request (but only if CRON_SECRET is set)
    if (hasSecret) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        console.log('❌ Unauthorized cron request - wrong/missing auth header');
        console.log('Expected: Bearer [CRON_SECRET]');
        console.log('Received:', authHeader ? 'Bearer [REDACTED]' : 'No authorization header');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      console.log('✅ Authorization verified');
    } else {
      console.log('⚠️ No CRON_SECRET set - running without authorization check');
    }

    // Check if we have required API keys
    if (!hasPerplexity) {
      console.log('❌ Missing PERPLEXITY_API_KEY');
      return NextResponse.json({ 
        success: false, 
        error: 'Missing PERPLEXITY_API_KEY environment variable' 
      }, { status: 500 });
    }

    if (!hasOpenAI) {
      console.log('❌ Missing OPENAI_API_KEY');
      return NextResponse.json({ 
        success: false, 
        error: 'Missing OPENAI_API_KEY environment variable' 
      }, { status: 500 });
    }

    if (!hasSupabase) {
      console.log('❌ Missing NEXT_PUBLIC_SUPABASE_URL');
      return NextResponse.json({ 
        success: false, 
        error: 'Missing NEXT_PUBLIC_SUPABASE_URL environment variable' 
      }, { status: 500 });
    }

    const scheduler = getScheduler();
    
    // Get yesterday's date for news collection
    const yesterday = subDays(new Date(), 1);
    const dateStr = format(yesterday, 'yyyy-MM-dd');
    
    console.log(`📅 Collecting news for: ${dateStr}`);
    
    // Fetch news for yesterday
    console.log('📰 Starting news fetch...');
    await scheduler.fetchAndProcessDeals(dateStr);
    console.log('✅ News fetch completed');
    
    // Clean up duplicates after fetching
    console.log('🧹 Cleaning up duplicate articles...');
    const duplicatesRemoved = await scheduler.runDuplicateCleanup();
    console.log(`🗑️ Removed ${duplicatesRemoved} duplicate articles`);
    
    console.log(`✅ Daily cron completed successfully at ${new Date().toISOString()}`);
    
    return NextResponse.json({
      success: true,
      message: 'Daily news collection completed',
      date: dateStr,
      duplicatesRemoved,
      timestamp: new Date().toISOString(),
      executionTime: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      environment: {
        hasSecret,
        hasPerplexity,
        hasOpenAI,
        hasSupabase
      }
    });

  } catch (error) {
    console.error('❌ Error in daily cron job:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return NextResponse.json({
      success: false,
      error: 'Daily news collection failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
} 