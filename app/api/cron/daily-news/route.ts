import { NextRequest, NextResponse } from 'next/server';
import { getScheduler } from '@/lib/scheduler';
import { format } from 'date-fns';

// Global variable to track if cron is running (simple in-memory lock)
let isRunning = false;
let lastRunTime: Date | null = null;

export async function GET(request: NextRequest) {
  const startTime = new Date();
  const userAgent = request.headers.get('user-agent') || 'Unknown';
  
  try {
    console.log('🕐 CRON JOB TRIGGERED');
    console.log('⏰ Start Time (UTC):', startTime.toISOString());
    console.log('⏰ Start Time (Local):', startTime.toLocaleString());
    console.log('🔧 User Agent:', userAgent);
    console.log('🔧 Request Headers:', Object.fromEntries(request.headers.entries()));
    
    // SAFEGUARD: Prevent multiple simultaneous runs
    if (isRunning) {
      console.log('⚠️ DUPLICATE RUN PREVENTED - Cron job already in progress');
      console.log('⚠️ Last run started at:', lastRunTime?.toISOString());
      return NextResponse.json({ 
        error: 'Cron job already running',
        message: 'Another cron job is already in progress. Skipping to prevent conflicts.',
        lastRunTime: lastRunTime?.toISOString(),
        currentTime: startTime.toISOString()
      }, { status: 429 });
    }
    
    // Set running flag
    isRunning = true;
    lastRunTime = startTime;
    
    console.log('✅ Cron job lock acquired - proceeding with news collection');
    
    // Check environment variables
    const hasSecret = !!process.env.CRON_SECRET;
    const hasPerplexity = !!process.env.PERPLEXITY_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    const isVercel = !!process.env.VERCEL;
    const vercelUrl = process.env.VERCEL_URL;
    
    console.log('🔧 Environment check:', { 
      hasSecret, 
      hasPerplexity, 
      hasOpenAI, 
      hasSupabase, 
      isVercel, 
      vercelUrl: vercelUrl?.substring(0, 20) + '...' 
    });
    
    // Authentication check
    if (hasSecret && !isVercel) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        console.log('❌ UNAUTHORIZED: Invalid or missing authorization header');
        console.log('❌ Expected: Bearer [CRON_SECRET]');
        console.log('❌ Received:', authHeader?.substring(0, 20) + '...');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      console.log('✅ Authorization verified via CRON_SECRET');
    } else if (isVercel) {
      console.log('✅ Vercel environment - using built-in authentication');
    } else {
      console.log('⚠️ No CRON_SECRET set - running without authorization');
    }
    
    // Environment validation
    if (!hasPerplexity || !hasOpenAI || !hasSupabase) {
      console.log('❌ MISSING ENVIRONMENT VARIABLES');
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
    
    console.log('📅 Target fetch date:', targetDate);
    console.log('🚀 Starting news collection process...');

    // Get scheduler and run the daily news collection
    const scheduler = getScheduler();
    await scheduler.fetchAndProcessDeals(targetDate);
    
    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMin = Math.round(durationMs / 60000 * 100) / 100;
    
    console.log('✅ CRON JOB COMPLETED SUCCESSFULLY');
    console.log('⏰ End Time (UTC):', endTime.toISOString());
    console.log('⏱️ Total Duration:', `${durationMin} minutes (${durationMs}ms)`);
    
    return NextResponse.json({ 
      success: true,
      message: `Daily news collection completed successfully for ${targetDate}`,
      timing: {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationMs,
        durationMinutes: durationMin
      },
      targetDate,
      userAgent,
      environment: {
        isVercel,
        hasAllRequiredKeys: hasPerplexity && hasOpenAI && hasSupabase
      }
    });

  } catch (error) {
    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();
    
    console.error('❌ CRON JOB FAILED');
    console.error('❌ Error:', error);
    console.error('⏰ Failure Time (UTC):', endTime.toISOString());
    console.error('⏱️ Failed Duration:', `${Math.round(durationMs / 60000 * 100) / 100} minutes`);
    
    return NextResponse.json({ 
      error: 'Daily news collection failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      timing: {
        startTime: startTime.toISOString(),
        failureTime: endTime.toISOString(),
        durationMs
      },
      userAgent
    }, { status: 500 });
    
  } finally {
    // Always release the lock
    isRunning = false;
    console.log('🔓 Cron job lock released');
  }
}

// Export POST handler as well for manual triggers
export async function POST(request: NextRequest) {
  console.log('📨 Manual POST trigger received - redirecting to GET handler');
  return GET(request);
} 