import { NextRequest, NextResponse } from 'next/server';
import { PerplexityService } from '@/lib/perplexity';
import { OpenAIService } from '@/lib/openai';
import { getDatabase } from '@/lib/database';
import { format, subDays } from 'date-fns';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { testDate, testDuplicateHandling } = body;
    
    const targetDate = testDate || format(subDays(new Date(), 1), 'yyyy-MM-dd');
    console.log(`🧪 Testing link improvements for date: ${targetDate}`);
    
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
    
    const db = getDatabase();
    
    if (testDuplicateHandling) {
      // Test duplicate handling and link updating
      console.log('🔍 Testing duplicate handling...');
      
      // Get existing deals for the date
      const existingDeals = await db.getDealsByDate(targetDate);
      console.log(`Found ${existingDeals.length} existing deals for ${targetDate}`);
      
      let updatesCount = 0;
      for (const deal of existingDeals) {
        if (!deal.source_url) {
          // Try to find duplicates and update
          const duplicates = await db.findDuplicateDeals(deal.title, deal.date);
          console.log(`Found ${duplicates.length} potential duplicates for: ${deal.title}`);
          updatesCount++;
        }
      }
      
      return NextResponse.json({
        success: true,
        testDate: targetDate,
        duplicateHandling: {
          existingDeals: existingDeals.length,
          dealsWithoutUrls: existingDeals.filter(d => !d.source_url).length,
          dealsWithUrls: existingDeals.filter(d => d.source_url).length,
          potentialUpdates: updatesCount
        }
      });
    }
    
    // Test enhanced news search and processing
    const perplexityService = new PerplexityService();
    const openaiService = new OpenAIService();
    
    console.log('🔍 Testing enhanced Perplexity search with link extraction...');
    const searchResults = await perplexityService.searchPrivateCreditDeals(targetDate);
    
    console.log('🤖 Testing enhanced OpenAI article extraction with source attribution...');
    const extractedArticles = await openaiService.extractNewsArticles(searchResults, 'Test Category');
    
    // Analyze the improvements
    const processedArticles = extractedArticles.map(article => ({
      title: article.title,
      summary: article.summary,
      source_url: article.source_url,
      original_source: article.original_source,
      hasUrl: !!article.source_url,
      hasBoldFormatting: article.summary.includes('**'),
      hasSourceAttribution: !!article.original_source && article.original_source !== 'Financial News',
      summaryLength: article.summary.length,
      sentenceCount: article.summary.split(/[.!?]+/).filter(s => s.trim().length > 0).length
    }));
    
    const stats = {
      totalArticles: processedArticles.length,
      articlesWithUrls: processedArticles.filter(a => a.hasUrl).length,
      articlesWithBoldFormatting: processedArticles.filter(a => a.hasBoldFormatting).length,
      articlesWithSourceAttribution: processedArticles.filter(a => a.hasSourceAttribution).length,
      averageSummaryLength: processedArticles.reduce((sum, a) => sum + a.summaryLength, 0) / processedArticles.length || 0,
      averageSentenceCount: processedArticles.reduce((sum, a) => sum + a.sentenceCount, 0) / processedArticles.length || 0,
      urlExtractionRate: (processedArticles.filter(a => a.hasUrl).length / processedArticles.length * 100).toFixed(1) + '%',
      sourceAttributionRate: (processedArticles.filter(a => a.hasSourceAttribution).length / processedArticles.length * 100).toFixed(1) + '%'
    };
    
    return NextResponse.json({
      success: true,
      testDate: targetDate,
      searchResultsLength: searchResults.length,
      improvements: {
        enhancedUrlExtraction: true,
        duplicateHandlingWithLinkUpdates: true,
        improvedSourceAttribution: true,
        structuredSummaries: true,
        boldFormattingSummaries: true
      },
      stats,
      sampleArticles: processedArticles.slice(0, 2), // Show first 2 articles
      searchPreview: searchResults.substring(0, 300) + '...'
    });
    
  } catch (error) {
    console.error('❌ Test link improvements error:', error);
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Test Link Improvements API',
    usage: {
      testExtraction: 'POST with { "testDate": "2024-06-23" } to test enhanced article extraction',
      testDuplicates: 'POST with { "testDate": "2024-06-23", "testDuplicateHandling": true } to test duplicate handling'
    },
    improvements: [
      'Enhanced URL extraction from Perplexity results',
      'Duplicate handling with link updates instead of skipping',
      'Better source attribution (Bloomberg, Reuters, etc.)',
      'Structured 2-3 sentence summaries with bold formatting',
      'Smart duplicate detection and link filling'
    ]
  });
} 