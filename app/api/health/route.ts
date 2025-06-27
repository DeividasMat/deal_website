import { NextResponse } from 'next/server';
import { getSupabaseDatabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Test environment variables
    const supabaseConfigured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const perplexityConfigured = !!process.env.PERPLEXITY_API_KEY;
    const openaiConfigured = !!process.env.OPENAI_API_KEY;

    let supabaseTest = { success: false, message: 'Not configured', tableCount: 0 };
    
    // Only test Supabase if it's configured
    if (supabaseConfigured) {
      try {
        const db = getSupabaseDatabase();
        const result = await db.testConnection();
        supabaseTest = {
          success: result.success,
          message: result.message,
          tableCount: result.tableCount || 0
        };
      } catch (error) {
        supabaseTest = { 
          success: false, 
          message: error instanceof Error ? error.message : 'Connection failed',
          tableCount: 0
        };
      }
    }

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'supabase',
        supabase: supabaseConfigured ? 'configured' : 'missing',
        perplexity: perplexityConfigured ? 'configured' : 'missing',
        openai: openaiConfigured ? 'configured' : 'missing'
      },
      supabaseTest: supabaseTest,
      readyToSaveNews: supabaseTest.success && perplexityConfigured && openaiConfigured
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const db = getSupabaseDatabase();
    
    // Save a test article to confirm saving works
    const testArticle = {
      date: new Date().toISOString().split('T')[0],
      title: 'HEALTH TEST: Database Save Test ' + new Date().getTime(),
      summary: 'This is a health test article to verify database saving is working correctly. **Test data** should save successfully.',
      content: 'Test content for health check article verification',
      source: 'Health Check',
      source_url: 'https://example.com/health-test',
      category: 'Health Test'
    };
    
    const savedId = await db.saveDeal(testArticle);
    const allDeals = await db.getAllDeals();
    
    return NextResponse.json({
      status: 'healthy',
      message: 'Health check with test article save completed',
      timestamp: new Date().toISOString(),
      testArticle: {
        saved: true,
        id: savedId,
        title: testArticle.title
      },
      database: {
        totalArticles: allDeals.length,
        testSaveWorking: true
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: 'Health check test save failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 