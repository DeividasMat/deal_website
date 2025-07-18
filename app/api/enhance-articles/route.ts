import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { OpenAIService } from '@/lib/openai';

export async function POST(request: NextRequest) {
  try {
    const { limit = 10, startId = 0 } = await request.json();
    
    const db = getDatabase();
    const openai = new OpenAIService();
    
    // Get all deals from database
    const allDeals = await db.getAllDeals();
    const dealsToProcess = allDeals.slice(startId, startId + limit);
    
    console.log(`🔧 Enhancing ${dealsToProcess.length} articles starting from ID ${startId}`);
    
    let enhanced = 0;
    let errors = 0;
    
    for (const deal of dealsToProcess) {
      try {
        console.log(`📝 Enhancing: ${deal.title.substring(0, 60)}...`);
        
        // Create enhanced title and summary
        const enhancement = await openai.enhanceArticle(deal);
        
        if (enhancement.title && enhancement.summary) {
          // Update the deal in database
          const updatedDeal = {
            ...deal,
            title: enhancement.title,
            summary: enhancement.summary
          };
          
          await db.saveDeal(updatedDeal);
          enhanced++;
          console.log(`✅ Enhanced: ${enhancement.title}`);
        } else {
          console.log(`⚠️ Skipped: No enhancement generated for ${deal.title}`);
        }
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Error enhancing deal ${deal.id}:`, error);
        errors++;
      }
    }
    
    return NextResponse.json({
      success: true,
      processed: dealsToProcess.length,
      enhanced,
      errors,
      nextStartId: startId + limit,
      hasMore: startId + limit < allDeals.length,
      totalDeals: allDeals.length
    });
    
  } catch (error) {
    console.error('Error in enhance-articles API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to enhance articles', details: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const db = getDatabase();
    const allDeals = await db.getAllDeals();
    
    return NextResponse.json({
      totalDeals: allDeals.length,
      message: 'Use POST with { limit: 10, startId: 0 } to start enhancement'
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get deal count' },
      { status: 500 }
    );
  }
} 