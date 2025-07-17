import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { OpenAIService } from '@/lib/openai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { dryRun = true, batchSize = 20 } = body;
    
    console.log(`🧹 Starting comprehensive duplicate cleanup (dryRun: ${dryRun})`);
    
    const db = getDatabase();
    const openai = new OpenAIService();
    
    // Get all articles from database
    const allArticles = await db.getAllDeals();
    console.log(`📊 Found ${allArticles.length} total articles in database`);
    
    if (allArticles.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No articles found in database',
        processed: 0
      });
    }
    
    // Group articles by date for more efficient processing
    const articlesByDate: { [key: string]: any[] } = {};
    allArticles.forEach(article => {
      if (!articlesByDate[article.date]) {
        articlesByDate[article.date] = [];
      }
      articlesByDate[article.date].push(article);
    });
    
    let totalDuplicatesFound = 0;
    let totalDuplicatesRemoved = 0;
    let errors = 0;
    const duplicateGroups: any[] = [];
    const processedDates: string[] = [];
    
    // Process each date
    for (const [date, articles] of Object.entries(articlesByDate)) {
      if (articles.length < 2) {
        console.log(`📅 Skipping ${date} - only ${articles.length} article(s)`);
        continue;
      }
      
      console.log(`📅 Processing ${date} - ${articles.length} articles`);
      
      try {
        // Process articles in batches for this date
        const batches = [];
        for (let i = 0; i < articles.length; i += batchSize) {
          batches.push(articles.slice(i, i + batchSize));
        }
        
        for (const batch of batches) {
          if (batch.length < 2) continue;
          
          console.log(`🔍 Analyzing batch of ${batch.length} articles for ${date}`);
          
          // Use OpenAI to find duplicates in this batch
          const duplicatesInBatch = await findDuplicatesWithOpenAI(batch, openai);
          
          if (duplicatesInBatch.length > 0) {
            duplicateGroups.push(...duplicatesInBatch);
            totalDuplicatesFound += duplicatesInBatch.reduce((sum, group) => sum + group.toDelete.length, 0);
            
            console.log(`🔍 Found ${duplicatesInBatch.length} duplicate groups in batch`);
          }
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        processedDates.push(date);
        
      } catch (error) {
        console.error(`❌ Error processing date ${date}:`, error);
        errors++;
      }
    }
    
    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        message: `Found ${totalDuplicatesFound} duplicates across ${duplicateGroups.length} groups`,
        results: {
          totalArticles: allArticles.length,
          processedDates: processedDates.length,
          duplicateGroups: duplicateGroups.length,
          duplicatesFound: totalDuplicatesFound,
          errors,
          details: duplicateGroups.map(group => ({
            reason: group.reason,
            keepingTitle: group.keep.title.substring(0, 60) + '...',
            keepingId: group.keep.id,
            deletingIds: group.toDelete.map((a: any) => a.id),
            deletingTitles: group.toDelete.map((a: any) => a.title.substring(0, 40) + '...')
          }))
        }
      });
    }
    
    // Actually remove duplicates
    for (const group of duplicateGroups) {
      for (const articleToDelete of group.toDelete) {
        try {
          if (!articleToDelete.id) continue;
          
          await db.deleteDeal(articleToDelete.id);
          console.log(`🗑️ Deleted duplicate: "${articleToDelete.title.substring(0, 50)}..."`);
          totalDuplicatesRemoved++;
          
        } catch (deleteError) {
          console.error(`❌ Failed to delete article ${articleToDelete.id}:`, deleteError);
          errors++;
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Duplicate cleanup completed`,
      results: {
        totalArticles: allArticles.length,
        processedDates: processedDates.length,
        duplicateGroups: duplicateGroups.length,
        duplicatesFound: totalDuplicatesFound,
        duplicatesRemoved: totalDuplicatesRemoved,
        errors,
        finalCount: allArticles.length - totalDuplicatesRemoved
      }
    });
    
  } catch (error) {
    console.error('❌ Duplicate cleanup error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function findDuplicatesWithOpenAI(articles: any[], openai: OpenAIService): Promise<any[]> {
  try {
    // Create a detailed prompt for OpenAI
    const articlesText = articles.map((article, index) => {
      return `${index + 1}. ID: ${article.id}
Title: ${article.title}
Summary: ${article.summary.substring(0, 200)}...
Source: ${article.source}
Date: ${article.date}
---`;
    }).join('\n\n');
    
    const prompt = `Analyze these ${articles.length} financial news articles and identify which ones are duplicates (reporting the same underlying news event).

${articlesText}

DUPLICATE CRITERIA:
- Same company/companies involved
- Same transaction type and amount
- Same underlying news event/announcement
- Minor wording differences don't matter - focus on the core story

For each group of duplicates:
1. Keep the article with the best source (avoid "Perplexity + OpenAI")
2. Keep the one with more detailed summary
3. Keep the one with higher upvotes

Respond with ONLY this JSON format (no other text):
{
  "duplicateGroups": [
    {
      "reason": "Same $500M Apollo credit facility to TechCorp",
      "keepArticle": 1,
      "deleteArticles": [2, 3]
    }
  ]
}

If no duplicates found, return: {"duplicateGroups": []}`;

    const response = await openai.summarizeDeals(prompt);
    let duplicateData;
    
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.summary.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        duplicateData = JSON.parse(jsonMatch[0]);
      } else {
        duplicateData = { duplicateGroups: [] };
      }
    } catch (parseError) {
      console.log('Could not parse OpenAI response, using fallback');
      return simpleFallbackDuplicateDetection(articles);
    }
    
    const duplicateGroups = duplicateData.duplicateGroups || [];
    
    // Convert to our internal format
    const result = duplicateGroups.map((group: any) => {
      const keepIndex = group.keepArticle - 1;
      const deleteIndices = group.deleteArticles.map((i: number) => i - 1);
      
      if (keepIndex < 0 || keepIndex >= articles.length) return null;
      
      const toDelete = deleteIndices
        .filter((i: number) => i >= 0 && i < articles.length)
        .map((i: number) => articles[i]);
      
      if (toDelete.length === 0) return null;
      
      return {
        reason: group.reason,
        keep: articles[keepIndex],
        toDelete: toDelete
      };
    }).filter(Boolean);
    
    console.log(`🤖 OpenAI found ${result.length} duplicate groups in batch`);
    return result;
    
  } catch (error) {
    console.error('Error using OpenAI for duplicate detection:', error);
    return simpleFallbackDuplicateDetection(articles);
  }
}

function simpleFallbackDuplicateDetection(articles: any[]): any[] {
  console.log('Using simple fallback duplicate detection');
  const duplicateGroups: any[] = [];
  const processed = new Set<number>();
  
  for (let i = 0; i < articles.length; i++) {
    if (processed.has(i)) continue;
    
    const article1 = articles[i];
    const similarArticles = [i];
    
    for (let j = i + 1; j < articles.length; j++) {
      if (processed.has(j)) continue;
      
      const article2 = articles[j];
      
      // Simple similarity check based on title and key terms
      const similarity = calculateSimilarity(article1.title, article2.title);
      
      if (similarity > 0.7) {
        similarArticles.push(j);
        processed.add(j);
      }
    }
    
    if (similarArticles.length > 1) {
      // Sort by quality - prefer specific sources and higher upvotes
      const sortedArticles = similarArticles.sort((a, b) => {
        const articleA = articles[a];
        const articleB = articles[b];
        
        // Prefer non-generic sources
        const sourceScoreA = articleA.source === 'Perplexity + OpenAI' ? 0 : 1;
        const sourceScoreB = articleB.source === 'Perplexity + OpenAI' ? 0 : 1;
        
        if (sourceScoreA !== sourceScoreB) return sourceScoreB - sourceScoreA;
        
        // Prefer higher upvotes
        return (articleB.upvotes || 0) - (articleA.upvotes || 0);
      });
      
      const keepIndex = sortedArticles[0];
      const deleteIndices = sortedArticles.slice(1);
      
      duplicateGroups.push({
        reason: `Similar titles: "${article1.title.substring(0, 50)}..."`,
        keep: articles[keepIndex],
        toDelete: deleteIndices.map(idx => articles[idx])
      });
    }
    
    processed.add(i);
  }
  
  return duplicateGroups;
}

function calculateSimilarity(str1: string, str2: string): number {
  const words1 = str1.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const words2 = str2.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  
  const commonWords = words1.filter(word => words2.includes(word));
  const totalUniqueWords = new Set([...words1, ...words2]).size;
  
  return commonWords.length / Math.max(totalUniqueWords, 1);
}

export async function GET() {
  return NextResponse.json({
    message: 'Comprehensive Duplicate Cleanup Script',
    usage: {
      method: 'POST',
      body: {
        dryRun: 'true (preview what would be deleted)',
        batchSize: '20 (articles per OpenAI analysis batch)'
      }
    },
    description: 'One-time script to clean up ALL duplicates in the database using OpenAI semantic analysis'
  });
} 