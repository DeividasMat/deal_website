import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { subDays } from 'date-fns';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    console.log('🧠 Starting smart deduplication with OpenAI...');
    
    const body = await request.json().catch(() => ({}));
    const daysBack = body.days || 7; // Default to last 7 days
    const dryRun = body.dryRun || false; // Preview mode by default
    
    const db = getDatabase();
    
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Get articles from the last week
    const cutoffDate = subDays(new Date(), daysBack);
    const allArticles = await db.getAllDeals();
    
    const recentArticles = allArticles
      .filter(article => {
        if (!article.created_at) return false;
        return new Date(article.created_at) >= cutoffDate;
      })
      .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime());
    
    console.log(`📊 Found ${recentArticles.length} articles from last ${daysBack} days`);
    
    if (recentArticles.length < 2) {
      return NextResponse.json({
        success: true,
        message: 'Not enough articles to deduplicate',
        articlesAnalyzed: recentArticles.length,
        duplicatesFound: 0
      });
    }
    
    // Group articles for similarity analysis
    const duplicateGroups: Array<{
      primaryArticle: any;
      duplicates: any[];
      reason: string;
      confidence: number;
    }> = [];
    
    // Compare articles in batches to avoid OpenAI rate limits
    const batchSize = 10;
    const processed = new Set<number>();
    
    for (let i = 0; i < recentArticles.length; i += batchSize) {
      const batch = recentArticles.slice(i, i + batchSize);
      console.log(`🔍 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(recentArticles.length/batchSize)}`);
      
      for (const article of batch) {
        if (processed.has(article.id!)) continue;
        
        // Find potential duplicates for this article
        const candidates = recentArticles.filter(other => 
          other.id !== article.id && 
          !processed.has(other.id!) &&
          Math.abs(new Date(other.created_at!).getTime() - new Date(article.created_at!).getTime()) < 24 * 60 * 60 * 1000 // Within 24 hours
        );
        
        if (candidates.length === 0) continue;
        
        // Use OpenAI to analyze similarity
        const similarityAnalysis = await analyzeSimilarity(openaiService, article, candidates);
        
        if (similarityAnalysis.duplicates.length > 0) {
          duplicateGroups.push({
            primaryArticle: {
              id: article.id,
              title: article.title,
              source: article.source,
              date: article.date,
              created_at: article.created_at
            },
            duplicates: similarityAnalysis.duplicates.map((dup: any) => ({
              id: dup.id,
              title: dup.title,
              source: dup.source,
              date: dup.date,
              created_at: dup.created_at,
              similarity: dup.similarity
            })),
            reason: similarityAnalysis.reason,
            confidence: similarityAnalysis.confidence
          });
          
          // Mark as processed
          processed.add(article.id!);
          similarityAnalysis.duplicates.forEach((dup: any) => processed.add(dup.id!));
        }
      }
    }
    
    console.log(`🔍 Found ${duplicateGroups.length} duplicate groups`);
    
    let deletedCount = 0;
    const deletionLog: any[] = [];
    
    if (!dryRun && duplicateGroups.length > 0) {
      // Actually delete duplicates (keep the primary article)
      for (const group of duplicateGroups) {
        for (const duplicate of group.duplicates) {
          try {
            await db.deleteDeal(duplicate.id);
            deletedCount++;
            deletionLog.push({
              deletedId: duplicate.id,
              deletedTitle: duplicate.title,
              keptId: group.primaryArticle.id,
              keptTitle: group.primaryArticle.title,
              reason: group.reason
            });
            console.log(`🗑️ Deleted duplicate: "${duplicate.title}" (kept: "${group.primaryArticle.title}")`);
          } catch (deleteError) {
            console.error(`❌ Error deleting article ${duplicate.id}:`, deleteError);
          }
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message: dryRun ? 'Smart deduplication analysis completed (dry run)' : `Smart deduplication completed: ${deletedCount} duplicates removed`,
      daysAnalyzed: daysBack,
      articlesAnalyzed: recentArticles.length,
      duplicateGroups: duplicateGroups.length,
      duplicatesFound: duplicateGroups.reduce((sum, group) => sum + group.duplicates.length, 0),
      duplicatesDeleted: deletedCount,
      dryRun,
      groups: duplicateGroups.map(group => ({
        primary: `${group.primaryArticle.title} (${group.primaryArticle.source})`,
        duplicates: group.duplicates.map(d => `${d.title} (${d.source}) - ${d.similarity}% similar`),
        reason: group.reason,
        confidence: group.confidence
      })),
      deletionLog: deletionLog.slice(0, 10) // Show first 10 deletions
    });
    
  } catch (error) {
    console.error('❌ Error in smart deduplication:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

async function analyzeSimilarity(openaiService: OpenAIService, primaryArticle: any, candidates: any[]) {
  try {
    const prompt = `Analyze if these news articles are about the same deal/event. 

PRIMARY ARTICLE:
Title: "${primaryArticle.title}"
Summary: "${primaryArticle.summary}"
Source: "${primaryArticle.source}"
Date: "${primaryArticle.date}"

CANDIDATE ARTICLES TO CHECK:
${candidates.map((article, index) => `
${index + 1}. Title: "${article.title}"
   Summary: "${article.summary}" 
   Source: "${article.source}"
   Date: "${article.date}"
   ID: ${article.id}
`).join('')}

Identify which candidates are duplicates of the primary article (reporting the same deal/transaction/event, even if worded differently).

Respond with JSON only:
{
  "duplicates": [
    {
      "id": candidate_id,
      "title": "candidate title",
      "source": "candidate source", 
      "similarity": percentage_number,
      "reasoning": "why this is a duplicate"
    }
  ],
  "reason": "overall explanation",
  "confidence": confidence_percentage
}

Only include articles that are clearly about the same specific deal/transaction. Different companies or amounts = not duplicates.`;

    const response = await openaiService['openai'].chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a financial news analyst that identifies duplicate articles.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1000,
      temperature: 0.1,
      response_format: { type: "json_object" }
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from OpenAI');
    
    const analysis = JSON.parse(content);
    
    // Filter for high confidence matches only
    const highConfidenceDuplicates = analysis.duplicates.filter((dup: any) => dup.similarity >= 80);
    
    return {
      duplicates: highConfidenceDuplicates,
      reason: analysis.reason || 'OpenAI similarity analysis',
      confidence: analysis.confidence || 0
    };
    
  } catch (error) {
    console.error('❌ Error in similarity analysis:', error);
    return {
      duplicates: [],
      reason: 'Analysis failed',
      confidence: 0
    };
  }
}

// GET endpoint to preview what would be deduplicated
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const daysBack = parseInt(url.searchParams.get('days') || '7');
  
  // Always do dry run for GET requests
  const mockRequest = {
    json: async () => ({ days: daysBack, dryRun: true })
  } as NextRequest;
  
  return POST(mockRequest);
} 