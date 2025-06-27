import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { OpenAIService } from '@/lib/openai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { 
      dateFilter = '2025-06-20', 
      limit = 50,
      preview = false,
      dryRun = true
    } = body;
    
    console.log(`🔄 Starting smart duplicate removal for articles ${dateFilter} and earlier`);
    
    const db = getDatabase();
    const openai = new OpenAIService();
    
    // Get articles from the specified date and earlier
    const allArticles = await db.getAllDeals();
    const articles = allArticles
      .filter(article => article.date <= dateFilter)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
    
    if (!articles || articles.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No articles found for duplicate analysis',
        processed: 0
      });
    }
    
    console.log(`Found ${articles.length} articles for duplicate analysis`);
    
    // Group articles by date for more efficient analysis
    const articlesByDate: { [key: string]: any[] } = {};
    articles.forEach(article => {
      if (!articlesByDate[article.date]) {
        articlesByDate[article.date] = [];
      }
      articlesByDate[article.date].push(article);
    });
    
    const duplicateGroups: any[] = [];
    let totalChecked = 0;
    
    // Analyze each date separately
    for (const [date, dateArticles] of Object.entries(articlesByDate)) {
      if (dateArticles.length < 2) continue; // Need at least 2 articles to have duplicates
      
      console.log(`🔍 Analyzing ${dateArticles.length} articles for ${date}`);
      
      // Use OpenAI to identify semantic duplicates
      const duplicateAnalysis = await analyzeForDuplicates(dateArticles, openai);
      if (duplicateAnalysis.length > 0) {
        duplicateGroups.push(...duplicateAnalysis);
      }
      
      totalChecked += dateArticles.length;
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    if (preview) {
      return NextResponse.json({
        success: true,
        preview: true,
        duplicateGroups: duplicateGroups.map(group => ({
          reason: group.reason,
          articles: group.articles.map((article: any) => ({
            id: article.id,
            date: article.date,
            title: article.title.substring(0, 60) + '...',
            source: article.source,
            toDelete: group.articlesToDelete.includes(article.id)
          }))
        })),
        totalGroups: duplicateGroups.length,
        totalChecked
      });
    }
    
    if (dryRun) {
      // Just show what would be deleted without actually deleting
      const toDeleteCount = duplicateGroups.reduce((sum, group) => sum + group.articlesToDelete.length, 0);
      
      return NextResponse.json({
        success: true,
        dryRun: true,
        message: `Found ${duplicateGroups.length} duplicate groups`,
        results: {
          duplicateGroups: duplicateGroups.length,
          articlesToDelete: toDeleteCount,
          totalChecked,
          details: duplicateGroups.map(group => ({
            reason: group.reason,
            keepingId: group.keepingId,
            deletingIds: group.articlesToDelete,
            keepingTitle: group.articles.find((a: any) => a.id === group.keepingId)?.title
          }))
        }
      });
    }
    
    // Actually remove duplicates
    let removed = 0;
    let errors = 0;
    
    for (const group of duplicateGroups) {
      for (const articleId of group.articlesToDelete) {
        try {
          await db.deleteDeal(articleId);
          console.log(`🗑️ Removed duplicate article ${articleId}`);
          removed++;
        } catch (error) {
          console.error(`❌ Failed to delete article ${articleId}:`, error);
          errors++;
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Smart duplicate removal completed`,
      results: {
        duplicateGroups: duplicateGroups.length,
        removed,
        errors,
        totalChecked,
        dateFilter,
        limit
      }
    });
    
  } catch (error) {
    console.error('❌ Smart duplicate removal error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function analyzeForDuplicates(articles: any[], openai: OpenAIService): Promise<any[]> {
  try {
    // Create content for OpenAI to analyze
    const analysisContent = articles.map((article, index) => 
      `${index + 1}. ID: ${article.id}
Title: ${article.title}
Summary: ${article.summary}
Source: ${article.source}
---`
    ).join('\n\n');
    
    const prompt = `Analyze these ${articles.length} articles for semantic duplicates (same news from different sources). 

${analysisContent}

Requirements:
1. Identify articles that report the SAME underlying news event/transaction
2. Consider articles duplicates if they have:
   - Same company/companies involved
   - Same transaction type (credit facility, fund raise, etc.)
   - Same or very similar amounts
   - Same timeframe/announcement
3. For each duplicate group, recommend which article to KEEP (best quality/source) and which to DELETE
4. Ignore minor differences in wording - focus on underlying news event
5. Be conservative - only mark as duplicates if clearly the same story

Return JSON format:
{
  "duplicateGroups": [
    {
      "reason": "Same $500M credit facility to TechCorp from Apollo",
      "articles": [1, 2, 3],
      "keepArticle": 1,
      "deleteArticles": [2, 3]
    }
  ]
}`;

    const summaryResult = await openai.summarizeDeals(prompt);
    
    // Parse the response to extract duplicate groups
    const content = summaryResult.summary;
    
    // Try to extract JSON from the response
    let duplicateGroups: any[] = [];
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        duplicateGroups = parsed.duplicateGroups || [];
      }
    } catch (parseError) {
      console.log('Could not parse OpenAI response as JSON, using fallback analysis');
      // Fallback: simple title-based analysis
      duplicateGroups = fallbackDuplicateAnalysis(articles);
    }
    
    // Convert to our internal format
    return duplicateGroups.map((group: any) => ({
      reason: group.reason,
      articles: articles.filter(a => group.articles.includes(articles.indexOf(a) + 1)),
      keepingId: articles[group.keepArticle - 1]?.id,
      articlesToDelete: group.deleteArticles.map((index: number) => articles[index - 1]?.id).filter(Boolean)
    })).filter(group => group.keepingId && group.articlesToDelete.length > 0);
    
  } catch (error) {
    console.error('Error in OpenAI duplicate analysis:', error);
    return fallbackDuplicateAnalysis(articles);
  }
}

function fallbackDuplicateAnalysis(articles: any[]): any[] {
  const duplicateGroups: any[] = [];
  const processed = new Set<number>();
  
  for (let i = 0; i < articles.length; i++) {
    if (processed.has(i)) continue;
    
    const article1 = articles[i];
    const duplicates = [i];
    
    for (let j = i + 1; j < articles.length; j++) {
      if (processed.has(j)) continue;
      
      const article2 = articles[j];
      
      // Simple similarity check
      const similarity = calculateSimilarity(article1.title, article2.title);
      if (similarity > 0.7) {
        duplicates.push(j);
        processed.add(j);
      }
    }
    
    if (duplicates.length > 1) {
      // Keep the one with the best source or most upvotes
      const sortedDuplicates = duplicates.sort((a, b) => {
        const articleA = articles[a];
        const articleB = articles[b];
        
        // Prefer specific sources over generic ones
        if (articleA.source !== 'Perplexity + OpenAI' && articleB.source === 'Perplexity + OpenAI') return -1;
        if (articleA.source === 'Perplexity + OpenAI' && articleB.source !== 'Perplexity + OpenAI') return 1;
        
        // Prefer articles with more upvotes
        return (articleB.upvotes || 0) - (articleA.upvotes || 0);
      });
      
      const keepIndex = sortedDuplicates[0];
      const deleteIndices = sortedDuplicates.slice(1);
      
      duplicateGroups.push({
        reason: `Similar titles detected: "${article1.title.substring(0, 50)}..."`,
        articles: duplicates.map(idx => articles[idx]),
        keepingId: articles[keepIndex].id,
        articlesToDelete: deleteIndices.map(idx => articles[idx].id)
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
  const totalWords = new Set([...words1, ...words2]).size;
  
  return commonWords.length / Math.max(totalWords, 1);
}

export async function GET() {
  return NextResponse.json({
    message: 'Smart Duplicate Removal Endpoint',
    usage: {
      method: 'POST',
      body: {
        dateFilter: '2025-06-20 (articles on or before this date)',
        limit: '50 (number of articles to analyze)',
        preview: 'true (preview mode - show duplicate groups without action)',
        dryRun: 'true (show what would be deleted without deleting)'
      }
    },
    description: 'Uses OpenAI to identify semantic duplicates from different sources and removes them intelligently'
  });
} 