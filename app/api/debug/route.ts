import { NextRequest, NextResponse } from 'next/server';
import { PerplexityService } from '@/lib/perplexity';
import { OpenAIService } from '@/lib/openai';
import { format, subDays } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const testDate = searchParams.get('date') || format(subDays(new Date(), 1), 'yyyy-MM-dd');
    
    console.log(`Debug: Testing search for date ${testDate}`);
    
    // Test API key availability
    const hasPerplexity = !!process.env.PERPLEXITY_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    
    let searchResult = '';
    let summaryResult = null;
    let error = null;
    
    if (!hasPerplexity) {
      error = 'PERPLEXITY_API_KEY not configured';
    } else if (!hasOpenAI) {
      error = 'OPENAI_API_KEY not configured';
    } else {
      try {
        // Test Perplexity search
        console.log('Debug: Starting Perplexity search...');
        const perplexityService = new PerplexityService();
        searchResult = await perplexityService.searchPrivateCreditDeals(testDate);
        
        console.log(`Debug: Search completed, length: ${searchResult.length} characters`);
        
        if (searchResult && searchResult.length > 100) {
          // Test OpenAI summarization
          console.log('Debug: Starting OpenAI summarization...');
          const openaiService = new OpenAIService();
          summaryResult = await openaiService.summarizeDeals(searchResult);
          console.log('Debug: Summarization completed');
        }
      } catch (testError) {
        error = testError instanceof Error ? testError.message : 'Unknown error';
        console.error('Debug: Error during test:', testError);
      }
    }
    
    return NextResponse.json({
      status: 'debug',
      timestamp: new Date().toISOString(),
      testDate,
      apiKeys: {
        perplexity: hasPerplexity ? 'configured' : 'missing',
        openai: hasOpenAI ? 'configured' : 'missing'
      },
      searchResults: {
        length: searchResult.length,
        preview: searchResult.substring(0, 500) + (searchResult.length > 500 ? '...' : ''),
        hasContent: searchResult.length > 100
      },
      summary: summaryResult,
      error
    });
    
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Debug test failed',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 