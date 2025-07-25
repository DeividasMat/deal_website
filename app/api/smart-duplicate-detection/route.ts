import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { OpenAIService } from '@/lib/openai';
import { format, subDays } from 'date-fns';

export async function POST(request: NextRequest) {
  try {
    const { daysBack = 3, batchSize = 10 } = await request.json();
    
    const db = getDatabase();
    const openai = new OpenAIService();
    
    // Get recent articles from the last few days
    const cutoffDate = format(subDays(new Date(), daysBack), 'yyyy-MM-dd');
    const allDeals = await db.getAllDeals();
    
    const recentDeals = allDeals.filter(deal => deal.date >= cutoffDate)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    console.log(`🔍 Analyzing ${recentDeals.length} recent articles for smart duplicates (since ${cutoffDate})`);
    
    let duplicatesFound = 0;
    let duplicatesRemoved = 0;
    let processed = 0;
    
    // Group articles by date for more efficient processing
    const dealsByDate: { [key: string]: any[] } = {};
    recentDeals.forEach(deal => {
      if (!dealsByDate[deal.date]) {
        dealsByDate[deal.date] = [];
      }
      dealsByDate[deal.date].push(deal);
    });
    
    // Process each date group
    for (const [date, dealsOnDate] of Object.entries(dealsByDate)) {
      if (dealsOnDate.length < 2) continue; // Skip if only one article
      
      console.log(`📅 Processing ${dealsOnDate.length} articles from ${date}`);
      
      // Compare articles in batches
      for (let i = 0; i < dealsOnDate.length; i += batchSize) {
        const batch = dealsOnDate.slice(i, i + batchSize);
        
        for (let j = 0; j < batch.length; j++) {
          for (let k = j + 1; k < batch.length; k++) {
            const article1 = batch[j];
            const article2 = batch[k];
            
            try {
              const isDuplicate = await openai.detectSemanticDuplicate(article1, article2);
              processed++;
              
              if (isDuplicate) {
                duplicatesFound++;
                console.log(`🔍 Found duplicate: "${article1.title}" vs "${article2.title}"`);
                
                // Keep the better article (more upvotes, longer summary, or more recent)
                const article1Score = (article1.upvotes || 0) + article1.summary.length + (new Date(article1.created_at || 0).getTime() / 1000000);
                const article2Score = (article2.upvotes || 0) + article2.summary.length + (new Date(article2.created_at || 0).getTime() / 1000000);
                
                const articleToRemove = article1Score >= article2Score ? article2 : article1;
                
                // Remove the lower quality duplicate
                await db.deleteDeal(articleToRemove.id);
                duplicatesRemoved++;
                console.log(`🗑️ Removed duplicate: "${articleToRemove.title}"`);
                
                // Remove from local array to avoid processing again
                const indexToRemove = batch.indexOf(articleToRemove);
                if (indexToRemove > -1) {
                  batch.splice(indexToRemove, 1);
                  if (indexToRemove <= j) j--;
                  if (indexToRemove <= k) k--;
                }
              }
              
              // Small delay to avoid rate limits
              await new Promise(resolve => setTimeout(resolve, 500));
              
            } catch (error) {
              console.error(`Error comparing articles:`, error);
            }
          }
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      analyzed: recentDeals.length,
      comparisons: processed,
      duplicatesFound,
      duplicatesRemoved,
      daysAnalyzed: daysBack,
      cutoffDate,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in smart duplicate detection:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Smart duplicate detection failed', details: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Smart duplicate detection using OpenAI contextual analysis',
    usage: 'POST with { daysBack: 3, batchSize: 10 } to start detection'
  });
} 