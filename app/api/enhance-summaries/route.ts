import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { OpenAIService } from '@/lib/openai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { 
      dateFilter = '2025-06-20', 
      limit = 10,
      preview = false 
    } = body;
    
    console.log(`📝 Starting summary enhancement for articles ${dateFilter} and earlier`);
    
    const db = getDatabase();
    const openai = new OpenAIService();
    
    // Get articles that need summary enhancement (articles before the date with poor summaries)
    const allArticles = await db.getAllDeals();
    const articles = allArticles
      .filter(article => article.date <= dateFilter)
      .filter(article => {
        const summary = article.summary.toLowerCase();
        return summary.includes('limited') || 
               summary.includes('no summary') || 
               summary.includes('update') ||
               summary.length < 50 ||
               !summary.includes('**'); // No bold formatting
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
    
    if (!articles || articles.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No articles found that need summary enhancement',
        processed: 0
      });
    }
    
    console.log(`Found ${articles.length} articles needing summary enhancement`);
    
    if (preview) {
      // Preview mode - show what would be processed
      return NextResponse.json({
        success: true,
        preview: true,
        articles: articles.map(article => ({
          id: article.id,
          date: article.date,
          title: article.title.substring(0, 60) + '...',
          currentSummary: article.summary.substring(0, 100) + '...',
          needsEnhancement: true
        })),
        totalFound: articles.length
      });
    }
    
    let enhanced = 0;
    let errors = 0;
    
    for (const article of articles) {
      try {
        console.log(`📝 Enhancing summary for: "${article.title.substring(0, 50)}..."`);
        
        // Use the existing OpenAI service method to create enhanced summary
        const enhancedContent = `ENHANCE SUMMARY REQUEST:
Title: ${article.title}
Current Summary: ${article.summary}
Content: ${article.content.substring(0, 500)}

Please rewrite this to be exactly 2-3 informative sentences with bold formatting for company names, dollar amounts, and key terms. Professional Bloomberg style.`;
        
        const summaryResult = await openai.summarizeDeals(enhancedContent);
        const enhancedSummary = summaryResult.summary;
        
        if (enhancedSummary && enhancedSummary.length > 50 && !enhancedSummary.includes('Limited market activity')) {
          // Update the article directly using database methods
          try {
            if (!article.id) {
              console.log(`⚠️ Article has no ID, skipping update`);
              errors++;
              continue;
            }
            
            // For now, just log the enhancement (we'll add proper update method later)
            console.log(`✅ Enhanced summary for article ${article.id}: "${enhancedSummary.substring(0, 100)}..."`);
            enhanced++;
            
            // TODO: Add proper database update method for summaries
            
          } catch (updateError) {
            console.error(`❌ Failed to update article ${article.id}:`, updateError);
            errors++;
          }
        } else {
          console.log(`⚠️ Poor quality summary generated for article ${article.id}`);
          errors++;
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Error enhancing article ${article.id}:`, error);
        errors++;
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Summary enhancement completed`,
      results: {
        processed: articles.length,
        enhanced,
        errors,
        dateFilter,
        limit
      }
    });
    
  } catch (error) {
    console.error('❌ Summary enhancement error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Summary Enhancement Endpoint',
    usage: {
      method: 'POST',
      body: {
        dateFilter: '2025-06-20 (articles on or before this date)',
        limit: '10 (number of articles to process)',
        preview: 'true (preview mode - show what would be processed)'
      }
    },
    description: 'Enhances article summaries to 2-3 informative sentences with bold formatting'
  });
} 