import { NextRequest, NextResponse } from 'next/server';
import { getScheduler } from '@/lib/scheduler';
import { format, subDays } from 'date-fns';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Manual trigger: Starting daily news collection...');
    console.log('🕐 Manual trigger executed at:', new Date().toISOString());
    
    // Check environment variables
    const hasSecret = !!process.env.CRON_SECRET;
    const hasPerplexity = !!process.env.PERPLEXITY_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    
    console.log('Environment check:', { hasSecret, hasPerplexity, hasOpenAI, hasSupabase });
    
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
    
    // Allow custom date or use today
    const body = await request.json().catch(() => ({}));
    const targetDate = body.date || format(new Date(), 'yyyy-MM-dd');
    
    console.log(`📅 Collecting news for: ${targetDate}`);
    console.log(`🕐 Current time: ${new Date().toISOString()}`);
    
    // Fetch news for the target date
    console.log('📰 Starting news fetch...');
    await scheduler.fetchAndProcessDeals(targetDate);
    console.log('✅ News fetch completed');
    
    // Clean up duplicates after fetching
    console.log('🧹 Cleaning up duplicate articles...');
    // const duplicatesRemoved = await scheduler.runDuplicateCleanup();
    // console.log(`🗑️ Removed ${duplicatesRemoved} duplicate articles`);
    
    // Clean up database duplicates with advanced AI detection
    console.log('🧹 Running advanced database duplicate cleanup...');
    // const { advancedDuplicateCleaner } = await import('@/lib/advanced-duplicate-cleaner');
    // const dbCleanupResult = await advancedDuplicateCleaner.cleanDatabase();
    // console.log(`🗑️ Advanced cleanup: removed ${dbCleanupResult.duplicatesRemoved} duplicates, kept ${dbCleanupResult.articlesKept} articles`);
    
    console.log(`✅ Manual trigger completed successfully at ${new Date().toISOString()}`);
    
    return NextResponse.json({
      success: true,
      message: 'Manual news collection completed',
      date: targetDate,
      // duplicatesRemoved,
      // databaseCleanup: {
      //   duplicatesRemoved: dbCleanupResult.duplicatesRemoved,
      //   articlesKept: dbCleanupResult.articlesKept,
      //   duplicateGroupsFound: dbCleanupResult.duplicatesFound
      // },
      timestamp: new Date().toISOString(),
      executionTime: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      trigger: 'manual',
      environment: {
        hasSecret,
        hasPerplexity,
        hasOpenAI,
        hasSupabase
      }
    });

  } catch (error) {
    console.error('❌ Error in manual trigger:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return NextResponse.json({
      success: false,
      error: 'Manual news collection failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      trigger: 'manual',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

// GET to show status
export async function GET() {
  const hasSecret = !!process.env.CRON_SECRET;
  const hasPerplexity = !!process.env.PERPLEXITY_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  
  return NextResponse.json({
    message: 'Manual trigger endpoint ready',
    timestamp: new Date().toISOString(),
    environment: {
      hasSecret,
      hasPerplexity,
      hasOpenAI,
      hasSupabase
    },
    usage: {
      method: 'POST',
      body: 'Optional: { "date": "2024-12-25" }',
      description: 'Triggers news collection for specified date or today'
    }
  });
} 