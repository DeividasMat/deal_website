import { NextRequest, NextResponse } from 'next/server';
import { format } from 'date-fns';

export async function GET(request: NextRequest) {
  console.log('🔔 Test cron triggered at:', new Date().toISOString());
  
  try {
    const now = new Date();
    const timestamp = now.toISOString();
    const userTime = format(now, 'yyyy-MM-dd HH:mm:ss');
    
    // Log some environment info
    console.log('Environment variables check:');
    console.log('- CRON_SECRET exists:', !!process.env.CRON_SECRET);
    console.log('- PERPLEXITY_API_KEY exists:', !!process.env.PERPLEXITY_API_KEY);
    console.log('- OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
    console.log('- SUPABASE_URL exists:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
    
    const response = {
      success: true,
      message: 'Test cron job executed successfully',
      timestamp,
      userTime,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      headers: Object.fromEntries(request.headers.entries()),
      environment: {
        hasSecret: !!process.env.CRON_SECRET,
        hasPerplexity: !!process.env.PERPLEXITY_API_KEY,
        hasOpenAI: !!process.env.OPENAI_API_KEY,
        hasSupabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL
      }
    };
    
    console.log('Test cron response:', JSON.stringify(response, null, 2));
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('❌ Error in test cron:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
} 