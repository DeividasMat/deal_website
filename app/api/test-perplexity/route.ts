import { NextResponse } from 'next/server';
import { PerplexityService } from '@/lib/perplexity';

export async function GET() {
  try {
    const perplexityService = new PerplexityService();
    
    // Test for today and yesterday
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    console.log(`Testing Perplexity for ${today} and ${yesterday}`);
    
    // Test today
    const todayContent = await perplexityService.searchPrivateCreditDeals(today);
    console.log(`Today content length: ${todayContent?.length || 0}`);
    
    // Test yesterday  
    const yesterdayContent = await perplexityService.searchPrivateCreditDeals(yesterday);
    console.log(`Yesterday content length: ${yesterdayContent?.length || 0}`);
    
    return NextResponse.json({
      success: true,
      results: {
        today: {
          date: today,
          hasContent: !!todayContent,
          contentLength: todayContent?.length || 0,
          preview: todayContent?.substring(0, 500) || 'No content',
          contentSnippet: todayContent?.substring(0, 1000) || 'No content'
        },
        yesterday: {
          date: yesterday,
          hasContent: !!yesterdayContent,
          contentLength: yesterdayContent?.length || 0,
          preview: yesterdayContent?.substring(0, 500) || 'No content',
          contentSnippet: yesterdayContent?.substring(0, 1000) || 'No content'
        }
      }
    });
    
  } catch (error) {
    console.error('Perplexity test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 