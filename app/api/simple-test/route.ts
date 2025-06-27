import { NextResponse } from 'next/server';
import { PerplexityService } from '@/lib/perplexity';
import { getDatabase } from '@/lib/database';

export async function POST() {
  try {
    console.log('🧪 Simple test starting...');
    
    // Test 1: Basic environment check
    const hasPerplexity = !!process.env.PERPLEXITY_API_KEY;
    const hasSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    
    if (!hasPerplexity || !hasSupabase) {
      return NextResponse.json({
        success: false,
        error: 'Missing environment variables',
        hasPerplexity,
        hasSupabase
      });
    }
    
    // Test 2: Try Perplexity for today
    console.log('🔍 Testing Perplexity...');
    const perplexityService = new PerplexityService();
    const content = await perplexityService.searchPrivateCreditDeals('2025-06-27');
    
    console.log(`📄 Perplexity content length: ${content?.length || 0}`);
    
    // Test 3: Database connection
    console.log('💾 Testing database...');
    const db = getDatabase();
    const allDeals = await db.getAllDeals();
    
    console.log(`📊 Current database has: ${allDeals.length} articles`);
    
    // Test 4: Try to save a simple test article
    console.log('💾 Testing article save...');
    const testArticle = {
      date: '2025-06-27',
      title: 'TEST: Simple Test Article ' + Date.now(),
      summary: 'This is a test article to verify database saving works',
      content: 'Test content',
      source: 'Test Source',
      source_url: 'https://example.com',
      category: 'Test Category'
    };
    
    const savedId = await db.saveDeal(testArticle);
    console.log(`✅ Test article saved with ID: ${savedId}`);
    
    return NextResponse.json({
      success: true,
      results: {
        environment: { hasPerplexity, hasSupabase },
        perplexityContentLength: content?.length || 0,
        perplexityPreview: content?.substring(0, 200) || 'No content',
        databaseArticleCount: allDeals.length,
        testArticleSaved: savedId,
        testArticleTitle: testArticle.title
      }
    });
    
  } catch (error) {
    console.error('❌ Simple test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Simple test endpoint - POST to run tests'
  });
} 