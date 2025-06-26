import { NextRequest, NextResponse } from 'next/server';
import { getScheduler } from '@/lib/scheduler';
import { format } from 'date-fns';

// Public endpoint for testing - no authentication required
export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Public test endpoint called at:', new Date().toISOString());
    
    // Get URL parameters
    const url = new URL(request.url);
    const testDate = url.searchParams.get('date') || '2025-06-25'; // Default to yesterday
    
    console.log(`📅 Testing news collection for date: ${testDate}`);
    
    // Check environment variables
    const hasPerplexity = !!process.env.PERPLEXITY_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    
    console.log('Environment check:', { hasPerplexity, hasOpenAI, hasSupabase });
    
    if (!hasPerplexity || !hasOpenAI || !hasSupabase) {
      return NextResponse.json({
        success: false,
        error: 'Missing required environment variables',
        environment: { hasPerplexity, hasOpenAI, hasSupabase }
      }, { status: 500 });
    }
    
    // Run the scheduler
    const scheduler = getScheduler();
    console.log('📰 Starting news collection...');
    
    await scheduler.fetchAndProcessDeals(testDate);
    
    console.log('✅ News collection completed successfully');
    
    return NextResponse.json({
      success: true,
      message: `News collection completed for ${testDate}`,
      date: testDate,
      timestamp: new Date().toISOString(),
      executionTime: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      note: 'This is a public test endpoint - check your database for new articles'
    });
    
  } catch (error) {
    console.error('❌ Error in public test:', error);
    
    return NextResponse.json({
      success: false,
      error: 'News collection failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Also support POST
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const testDate = body.date || '2025-06-25';
    
    console.log('🧪 Public test POST endpoint called at:', new Date().toISOString());
    console.log(`📅 Testing news collection for date: ${testDate}`);
    
    // Check environment variables
    const hasPerplexity = !!process.env.PERPLEXITY_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    
    if (!hasPerplexity || !hasOpenAI || !hasSupabase) {
      return NextResponse.json({
        success: false,
        error: 'Missing required environment variables',
        environment: { hasPerplexity, hasOpenAI, hasSupabase }
      }, { status: 500 });
    }
    
    // Run the scheduler
    const scheduler = getScheduler();
    console.log('📰 Starting news collection...');
    
    await scheduler.fetchAndProcessDeals(testDate);
    
    console.log('✅ News collection completed successfully');
    
    return NextResponse.json({
      success: true,
      message: `News collection completed for ${testDate}`,
      date: testDate,
      timestamp: new Date().toISOString(),
      executionTime: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      note: 'This is a public test endpoint - check your database for new articles'
    });
    
  } catch (error) {
    console.error('❌ Error in public test POST:', error);
    
    return NextResponse.json({
      success: false,
      error: 'News collection failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 