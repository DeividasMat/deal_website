import { NextRequest, NextResponse } from 'next/server';
import { PerplexityService } from '@/lib/perplexity';
import { OpenAIService } from '@/lib/openai';
import { getDatabase } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 DEBUG: Starting comprehensive news collection debug...');
    
    const body = await request.json().catch(() => ({}));
    const testDate = body.date || '2025-06-27'; // Default to today
    
    const debugLog: any[] = [];
    
    // Step 1: Test environment variables
    debugLog.push({
      step: 1,
      name: 'Environment Variables Check',
      status: 'checking',
      data: {
        hasPerplexity: !!process.env.PERPLEXITY_API_KEY,
        hasOpenAI: !!process.env.OPENAI_API_KEY,
        hasSupabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        perplexityKeyLength: process.env.PERPLEXITY_API_KEY?.length || 0,
        openaiKeyLength: process.env.OPENAI_API_KEY?.length || 0
      }
    });
    
    if (!process.env.PERPLEXITY_API_KEY || !process.env.OPENAI_API_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      debugLog.push({
        step: 1,
        name: 'Environment Variables Check',
        status: 'FAILED',
        error: 'Missing required environment variables'
      });
      
      return NextResponse.json({
        success: false,
        error: 'Missing environment variables',
        debugLog
      }, { status: 500 });
    }
    
    debugLog.push({
      step: 1,
      name: 'Environment Variables Check',
      status: 'SUCCESS',
      message: 'All environment variables present'
    });
    
    // Step 2: Test Perplexity API
    console.log('🔍 DEBUG: Testing Perplexity API...');
    debugLog.push({
      step: 2,
      name: 'Perplexity API Test',
      status: 'running',
      date: testDate
    });
    
    let perplexityContent: string | null = null;
    try {
      const perplexityService = new PerplexityService();
      perplexityContent = await perplexityService.searchPrivateCreditDeals(testDate);
      
      debugLog.push({
        step: 2,
        name: 'Perplexity API Test',
        status: 'SUCCESS',
        data: {
          contentLength: perplexityContent?.length || 0,
          contentPreview: perplexityContent?.substring(0, 500) || 'No content',
          hasContent: !!perplexityContent && perplexityContent.length > 100
        }
      });
      
      if (!perplexityContent || perplexityContent.length < 100) {
        debugLog.push({
          step: 2,
          name: 'Perplexity Content Analysis',
          status: 'WARNING',
          message: 'Perplexity returned very little content',
          data: { content: perplexityContent || 'null' }
        });
      }
      
    } catch (perplexityError) {
      debugLog.push({
        step: 2,
        name: 'Perplexity API Test',
        status: 'FAILED',
        error: perplexityError instanceof Error ? perplexityError.message : 'Unknown error',
        stack: perplexityError instanceof Error ? perplexityError.stack : undefined
      });
      
      return NextResponse.json({
        success: false,
        error: 'Perplexity API failed',
        debugLog
      }, { status: 500 });
    }
    
    // Step 3: Test OpenAI processing
    console.log('🔍 DEBUG: Testing OpenAI processing...');
    debugLog.push({
      step: 3,
      name: 'OpenAI Processing Test',
      status: 'running'
    });
    
    let extractedArticles: any[] = [];
    try {
      const openaiService = new OpenAIService();
      extractedArticles = await openaiService.extractNewsArticles(perplexityContent!, 'Private Credit');
      
      debugLog.push({
        step: 3,
        name: 'OpenAI Processing Test',
        status: 'SUCCESS',
        data: {
          articlesExtracted: extractedArticles.length,
          articles: extractedArticles.slice(0, 3).map(article => ({
            title: article.title,
            category: article.category,
            source: article.original_source,
            hasUrl: !!article.source_url,
            summaryLength: article.summary?.length || 0
          }))
        }
      });
      
      if (extractedArticles.length === 0) {
        debugLog.push({
          step: 3,
          name: 'OpenAI Article Extraction',
          status: 'WARNING',
          message: 'OpenAI extracted 0 articles from content'
        });
      }
      
    } catch (openaiError) {
      debugLog.push({
        step: 3,
        name: 'OpenAI Processing Test',
        status: 'FAILED',
        error: openaiError instanceof Error ? openaiError.message : 'Unknown error',
        stack: openaiError instanceof Error ? openaiError.stack : undefined
      });
      
      return NextResponse.json({
        success: false,
        error: 'OpenAI processing failed',
        debugLog
      }, { status: 500 });
    }
    
    // Step 4: Test database connection and duplicate checking
    console.log('🔍 DEBUG: Testing database operations...');
    debugLog.push({
      step: 4,
      name: 'Database Connection Test',
      status: 'running'
    });
    
    let existingArticles: any[] = [];
    try {
      const db = getDatabase();
      existingArticles = await db.getAllDeals();
      
      debugLog.push({
        step: 4,
        name: 'Database Connection Test',
        status: 'SUCCESS',
        data: {
          totalExistingArticles: existingArticles.length,
          recentArticles: existingArticles.filter(article => {
            if (!article.created_at) return false;
            const daysDiff = (new Date().getTime() - new Date(article.created_at).getTime()) / (1000 * 60 * 60 * 24);
            return daysDiff <= 7;
          }).length
        }
      });
      
    } catch (dbError) {
      debugLog.push({
        step: 4,
        name: 'Database Connection Test',
        status: 'FAILED',
        error: dbError instanceof Error ? dbError.message : 'Unknown error'
      });
      
      return NextResponse.json({
        success: false,
        error: 'Database connection failed',
        debugLog
      }, { status: 500 });
    }
    
    // Step 5: Test duplicate detection
    console.log('🔍 DEBUG: Testing duplicate detection...');
    debugLog.push({
      step: 5,
      name: 'Duplicate Detection Test',
      status: 'running'
    });
    
    const duplicateAnalysis: any[] = [];
    const db = getDatabase();
    
    for (let i = 0; i < extractedArticles.length; i++) {
      const article = extractedArticles[i];
      
      try {
        const duplicates = await db.findDuplicateDeals(article.title, testDate);
        
        duplicateAnalysis.push({
          articleIndex: i,
          title: article.title,
          duplicatesFound: duplicates.length,
          duplicateIds: duplicates.map(d => d.id),
          wouldSkip: duplicates.length > 0
        });
        
      } catch (dupError) {
        duplicateAnalysis.push({
          articleIndex: i,
          title: article.title,
          error: dupError instanceof Error ? dupError.message : 'Unknown error'
        });
      }
    }
    
    debugLog.push({
      step: 5,
      name: 'Duplicate Detection Test',
      status: 'SUCCESS',
      data: {
        totalArticles: extractedArticles.length,
        duplicatesFound: duplicateAnalysis.filter(a => a.duplicatesFound > 0).length,
        wouldSave: duplicateAnalysis.filter(a => !a.wouldSkip && !a.error).length,
        analysis: duplicateAnalysis
      }
    });
    
    // Step 6: Test actual saving (dry run)
    console.log('🔍 DEBUG: Testing article saving (dry run)...');
    debugLog.push({
      step: 6,
      name: 'Article Saving Test (Dry Run)',
      status: 'running'
    });
    
    let saveResults: any[] = [];
    for (let i = 0; i < Math.min(extractedArticles.length, 3); i++) {
      const article = extractedArticles[i];
      
      try {
        // Don't actually save, just test the structure
        const articleData = {
          date: testDate,
          title: article.title,
          summary: article.summary,
          content: 'Test content',
          source: article.original_source || 'Test Source',
          source_url: article.source_url,
          category: article.category || 'Test Category'
        };
        
        saveResults.push({
          index: i,
          title: article.title,
          data: articleData,
          status: 'WOULD_SAVE'
        });
        
      } catch (saveError) {
        saveResults.push({
          index: i,
          title: article.title,
          status: 'WOULD_FAIL',
          error: saveError instanceof Error ? saveError.message : 'Unknown error'
        });
      }
    }
    
    debugLog.push({
      step: 6,
      name: 'Article Saving Test (Dry Run)',
      status: 'SUCCESS',
      data: {
        testedArticles: saveResults.length,
        wouldSave: saveResults.filter(r => r.status === 'WOULD_SAVE').length,
        wouldFail: saveResults.filter(r => r.status === 'WOULD_FAIL').length,
        results: saveResults
      }
    });
    
    // Summary
    const summary = {
      testDate,
      perplexityWorking: !!perplexityContent && perplexityContent.length > 100,
      perplexityContentLength: perplexityContent?.length || 0,
      openaiWorking: extractedArticles.length > 0,
      articlesExtracted: extractedArticles.length,
      databaseWorking: existingArticles.length > 0,
      duplicatesWouldSkip: duplicateAnalysis.filter(a => a.wouldSkip).length,
      articlesWouldSave: duplicateAnalysis.filter(a => !a.wouldSkip && !a.error).length,
      possibleIssues: [] as string[]
    };
    
    // Identify possible issues
    if (!summary.perplexityWorking) {
      summary.possibleIssues.push('Perplexity not returning content');
    }
    if (!summary.openaiWorking) {
      summary.possibleIssues.push('OpenAI not extracting articles');
    }
    if (summary.duplicatesWouldSkip === summary.articlesExtracted) {
      summary.possibleIssues.push('All articles being skipped as duplicates');
    }
    if (summary.articlesWouldSave === 0) {
      summary.possibleIssues.push('No articles would be saved');
    }
    
    return NextResponse.json({
      success: true,
      message: 'Debug analysis completed',
      summary,
      debugLog,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Debug error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'News Collection Debug Tool',
    usage: 'POST with optional {"date": "2025-06-27"}',
    description: 'Tests each step of the news collection process'
  });
} 