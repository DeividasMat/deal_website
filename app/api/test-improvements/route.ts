import { NextRequest, NextResponse } from 'next/server';
import { PerplexityService } from '@/lib/perplexity';
import { OpenAIService } from '@/lib/openai';
import { getDatabase } from '@/lib/database';
import { format, subDays } from 'date-fns';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { testDate } = body;
    
    const targetDate = testDate || format(subDays(new Date(), 1), 'yyyy-MM-dd');
    console.log(`🧪 Testing improvements for date: ${targetDate}`);
    
    // Test API key availability
    const hasPerplexity = !!process.env.PERPLEXITY_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    
    if (!hasPerplexity || !hasOpenAI) {
      return NextResponse.json({
        success: false,
        error: 'Missing API keys',
        missing: {
          perplexity: !hasPerplexity,
          openai: !hasOpenAI
        }
      }, { status: 400 });
    }
    
    // Test enhanced news search and processing
    const perplexityService = new PerplexityService();
    const openaiService = new OpenAIService();
    
    console.log('🔍 Testing enhanced Perplexity search...');
    const searchResults = await perplexityService.searchPrivateCreditDeals(targetDate);
    
    console.log('🤖 Testing enhanced OpenAI article extraction...');
    const extractedArticles = await openaiService.extractNewsArticles(searchResults, 'Test Category');
    
    // Show results
    const processedArticles = extractedArticles.map(article => ({
      title: article.title,
      summary: article.summary,
      source_url: article.source_url,
      hasUrl: !!article.source_url,
      hasBoldFormatting: article.summary.includes('**'),
      summaryLength: article.summary.length,
      sentenceCount: article.summary.split(/[.!?]+/).filter(s => s.trim().length > 0).length
    }));
    
    const stats = {
      totalArticles: processedArticles.length,
      articlesWithUrls: processedArticles.filter(a => a.hasUrl).length,
      articlesWithBoldFormatting: processedArticles.filter(a => a.hasBoldFormatting).length,
      averageSummaryLength: processedArticles.reduce((sum, a) => sum + a.summaryLength, 0) / processedArticles.length || 0,
      averageSentenceCount: processedArticles.reduce((sum, a) => sum + a.sentenceCount, 0) / processedArticles.length || 0
    };
    
    return NextResponse.json({
      success: true,
      testDate: targetDate,
      searchResultsLength: searchResults.length,
      improvements: {
        enhancedUrlExtraction: true,
        boldFormattingSummaries: true,
        multiSentenceSummaries: true
      },
      stats,
      sampleArticles: processedArticles.slice(0, 3), // Show first 3 articles
      searchPreview: searchResults.substring(0, 500) + '...'
    });
    
  } catch (error) {
    console.error('❌ Test improvements error:', error);
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Test Improvements API',
    usage: 'POST with { "testDate": "2024-06-23" } to test enhanced article extraction',
    improvements: [
      'Enhanced URL extraction from Perplexity results',
      'Bold formatting in summaries for key elements',
      '2-3 sentence summaries instead of 2',
      'Article links displayed above content',
      'Better source URL parsing'
    ]
  });
} 