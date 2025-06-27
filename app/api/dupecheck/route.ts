import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseDatabase } from '@/lib/supabase';

function calculateSimilarity(str1: string, str2: string): number {
  const words1 = str1.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const words2 = str2.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  
  const commonWords = words1.filter(word => words2.includes(word));
  const totalUniqueWords = new Set([...words1, ...words2]).size;
  
  return commonWords.length / Math.max(totalUniqueWords, 1);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dryRun = true } = body;
    
    console.log(`🔍 Starting duplicate cleanup (dryRun: ${dryRun})`);
    
    const db = getSupabaseDatabase();
    const allArticles = await db.getAllDeals();
    
    console.log(`📊 Analyzing ${allArticles.length} articles for duplicates`);
    
    // Simple duplicate detection based on title similarity
    const duplicateGroups: any[] = [];
    const processed = new Set<number>();
    
    for (let i = 0; i < allArticles.length; i++) {
      if (processed.has(i)) continue;
      
      const article1 = allArticles[i];
      const similarArticles = [i];
      
      for (let j = i + 1; j < allArticles.length; j++) {
        if (processed.has(j)) continue;
        
        const article2 = allArticles[j];
        const similarity = calculateSimilarity(article1.title, article2.title);
        
        if (similarity > 0.7) { // 70% similarity threshold
          similarArticles.push(j);
          processed.add(j);
        }
      }
      
      if (similarArticles.length > 1) {
        // Sort by quality - prefer specific sources and higher upvotes
        const sortedArticles = similarArticles.sort((a, b) => {
          const articleA = allArticles[a];
          const articleB = allArticles[b];
          
          // Prefer non-generic sources
          if (articleA.source !== 'Perplexity + OpenAI' && articleB.source === 'Perplexity + OpenAI') return -1;
          if (articleA.source === 'Perplexity + OpenAI' && articleB.source !== 'Perplexity + OpenAI') return 1;
          
          // Prefer higher upvotes
          return (articleB.upvotes || 0) - (articleA.upvotes || 0);
        });
        
        const keepIndex = sortedArticles[0];
        const deleteIndices = sortedArticles.slice(1);
        
        duplicateGroups.push({
          keep: allArticles[keepIndex],
          delete: deleteIndices.map(idx => allArticles[idx])
        });
      }
      
      processed.add(i);
    }
    
    const totalDuplicates = duplicateGroups.reduce((sum, group) => sum + group.delete.length, 0);
    
    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        message: `Found ${totalDuplicates} duplicates in ${duplicateGroups.length} groups`,
        results: {
          totalArticles: allArticles.length,
          duplicateGroups: duplicateGroups.length,
          duplicatesToDelete: totalDuplicates,
          details: duplicateGroups.map(group => ({
            keepTitle: group.keep.title.substring(0, 80),
            keepId: group.keep.id,
            keepSource: group.keep.source,
            deleteCount: group.delete.length,
            deleteInfo: group.delete.map((a: any) => ({
              id: a.id,
              title: a.title.substring(0, 80),
              source: a.source
            }))
          }))
        }
      });
    }
    
    // Actually delete duplicates
    let deleted = 0;
    for (const group of duplicateGroups) {
      for (const article of group.delete) {
        try {
          await db.deleteDeal(article.id!);
          console.log(`🗑️ Deleted duplicate: "${article.title.substring(0, 50)}..."`);
          deleted++;
        } catch (error) {
          console.error(`❌ Failed to delete article ${article.id}:`, error);
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Duplicate cleanup completed`,
      results: {
        totalArticles: allArticles.length,
        duplicateGroups: duplicateGroups.length,
        duplicatesDeleted: deleted,
        finalCount: allArticles.length - deleted
      }
    });
    
  } catch (error) {
    console.error('❌ Duplicate cleanup error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to run duplicate cleanup',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Duplicate Cleanup API',
    usage: 'POST with { "dryRun": true } to preview duplicates, or { "dryRun": false } to delete them'
  });
} 