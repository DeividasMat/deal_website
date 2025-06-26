import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { PerplexityService } from '@/lib/perplexity';
import { OpenAIService } from '@/lib/openai';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Starting system debug...');
    
    const db = getDatabase();
    const allDeals = await db.getAllDeals();
    
    // Check recent articles and their actual sources
    const recentArticles = allDeals
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 10);
    
    // Count source distribution
    const sourceDistribution: { [key: string]: number } = {};
    allDeals.forEach(deal => {
      const source = deal.source || 'Unknown';
      sourceDistribution[source] = (sourceDistribution[source] || 0) + 1;
    });
    
    // Test environment variables
    const hasPerplexity = !!process.env.PERPLEXITY_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    
    return NextResponse.json({
      debug: 'System Debug Report',
      timestamp: new Date().toISOString(),
      
      database: {
        totalArticles: allDeals.length,
        sourceDistribution,
        recentArticles: recentArticles.map(article => ({
          id: article.id,
          title: article.title.substring(0, 60) + '...',
          source: article.source,
          date: article.date,
          created_at: article.created_at,
          category: article.category
        }))
      },
      
      environment: {
        hasPerplexity,
        hasOpenAI,
        hasSupabase,
        perplexityKeyLength: process.env.PERPLEXITY_API_KEY?.length || 0,
        openaiKeyLength: process.env.OPENAI_API_KEY?.length || 0
      },
      
      issues: {
        sourcesStillGeneric: sourceDistribution['Perplexity + OpenAI'] || 0,
        missingEnvironmentVars: !hasPerplexity || !hasOpenAI || !hasSupabase
      }
    });
    
  } catch (error) {
    console.error('❌ Debug error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing news collection process...');
    
    const body = await request.json().catch(() => ({}));
    const testDate = body.date || '2025-06-26'; // Today
    
    // Test environment
    const hasPerplexity = !!process.env.PERPLEXITY_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    
    if (!hasPerplexity || !hasOpenAI || !hasSupabase) {
      return NextResponse.json({
        success: false,
        error: 'Missing environment variables',
        environment: { hasPerplexity, hasOpenAI, hasSupabase }
      }, { status: 500 });
    }
    
    console.log(`🔍 Testing Perplexity search for date: ${testDate}`);
    
    // Test Perplexity directly
    const perplexityService = new PerplexityService();
    const rawContent = await perplexityService.searchPrivateCreditDeals(testDate);
    
    console.log(`📄 Raw Perplexity content length: ${rawContent?.length || 0}`);
    console.log(`📄 First 500 chars: ${rawContent?.substring(0, 500) || 'No content'}`);
    
    if (!rawContent || rawContent.length < 100) {
      return NextResponse.json({
        success: false,
        error: 'No content returned from Perplexity',
        testDate,
        contentLength: rawContent?.length || 0,
        content: rawContent || 'No content'
      });
    }
    
    // Test OpenAI processing
    console.log(`🤖 Testing OpenAI article extraction...`);
    const openaiService = new OpenAIService();
    
    try {
      const articles = await openaiService.extractNewsArticles(rawContent, 'Private Credit');
      console.log(`📰 OpenAI extracted ${articles.length} articles`);
      
      return NextResponse.json({
        success: true,
        testDate,
        perplexityContent: {
          length: rawContent.length,
          preview: rawContent.substring(0, 500)
        },
        openaiExtraction: {
          articlesFound: articles.length,
          articles: articles.slice(0, 3).map(article => ({
            title: article.title,
            source: article.original_source || 'No source',
            category: article.category || 'No category',
            summaryLength: article.summary?.length || 0
          }))
        }
      });
      
    } catch (openaiError) {
      console.error('❌ OpenAI error:', openaiError);
      return NextResponse.json({
        success: false,
        error: 'OpenAI processing failed',
        testDate,
        perplexityContent: {
          length: rawContent.length,
          preview: rawContent.substring(0, 500)
        },
        openaiError: openaiError instanceof Error ? openaiError.message : 'Unknown OpenAI error'
      });
    }
    
  } catch (error) {
    console.error('❌ Debug POST error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 