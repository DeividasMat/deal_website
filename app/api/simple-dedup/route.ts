import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { subDays } from 'date-fns';

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Starting simple deduplication...');
    
    const body = await request.json().catch(() => ({}));
    const daysBack = body.days || 7; // Default to last 7 days
    const dryRun = body.dryRun !== false; // Default to dry run for safety
    
    const db = getDatabase();
    
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
    
    // Group articles by similarity
    const duplicateGroups: Array<{
      primary: any;
      duplicates: any[];
      reason: string;
    }> = [];
    
    const processed = new Set<number>();
    
    for (let i = 0; i < recentArticles.length; i++) {
      const article = recentArticles[i];
      if (processed.has(article.id!)) continue;
      
      const duplicates = [];
      
      for (let j = i + 1; j < recentArticles.length; j++) {
        const other = recentArticles[j];
        if (processed.has(other.id!)) continue;
        
        const similarity = calculateSimilarity(article, other);
        
        if (similarity.isDuplicate) {
          duplicates.push({
            ...other,
            similarity: similarity.score,
            reason: similarity.reason
          });
          processed.add(other.id!);
        }
      }
      
      if (duplicates.length > 0) {
        duplicateGroups.push({
          primary: article,
          duplicates,
          reason: `Found ${duplicates.length} similar articles`
        });
        processed.add(article.id!);
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
              keptId: group.primary.id,
              keptTitle: group.primary.title,
              reason: duplicate.reason
            });
            console.log(`🗑️ Deleted duplicate: "${duplicate.title}"`);
          } catch (deleteError) {
            console.error(`❌ Error deleting article ${duplicate.id}:`, deleteError);
          }
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message: dryRun ? 
        `Simple deduplication analysis completed (DRY RUN): ${duplicateGroups.reduce((sum, group) => sum + group.duplicates.length, 0)} duplicates found` :
        `Simple deduplication completed: ${deletedCount} duplicates removed`,
      daysAnalyzed: daysBack,
      articlesAnalyzed: recentArticles.length,
      duplicateGroups: duplicateGroups.length,
      duplicatesFound: duplicateGroups.reduce((sum, group) => sum + group.duplicates.length, 0),
      duplicatesDeleted: deletedCount,
      dryRun,
      preview: duplicateGroups.map(group => ({
        primary: `${group.primary.title} (${group.primary.source})`,
        duplicates: group.duplicates.map(d => `${d.title} (${d.source}) - ${d.similarity}% similar - ${d.reason}`),
        willDelete: group.duplicates.length
      })),
      deletionLog
    });
    
  } catch (error) {
    console.error('❌ Error in simple deduplication:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

function calculateSimilarity(article1: any, article2: any): { isDuplicate: boolean; score: number; reason: string } {
  const title1 = article1.title.toLowerCase();
  const title2 = article2.title.toLowerCase();
  const summary1 = (article1.summary || '').toLowerCase();
  const summary2 = (article2.summary || '').toLowerCase();
  
  // Extract key words from titles
  const words1 = title1.replace(/[^\w\s]/g, '').split(/\s+/).filter((w: string) => w.length > 3);
  const words2 = title2.replace(/[^\w\s]/g, '').split(/\s+/).filter((w: string) => w.length > 3);
  
  // Find company names (usually capitalized words)
  const companies1 = extractCompanyNames(article1.title);
  const companies2 = extractCompanyNames(article2.title);
  
  // Check for exact company match
  const sameCompany = companies1.some(c1 => companies2.some(c2 => 
    c1.toLowerCase() === c2.toLowerCase()
  ));
  
  // Check for similar dollar amounts
  const amounts1 = extractAmounts(article1.title + ' ' + article1.summary);
  const amounts2 = extractAmounts(article2.title + ' ' + article2.summary);
  const sameAmount = amounts1.some(a1 => amounts2.some(a2 => Math.abs(a1 - a2) < a1 * 0.1));
  
  // Calculate title word overlap
  const commonWords = words1.filter((w: string) => words2.includes(w));
  const titleSimilarity = commonWords.length / Math.max(words1.length, words2.length);
  
  // Check for similar transaction types
  const transactionTypes = ['credit', 'facility', 'loan', 'fund', 'acquisition', 'financing', 'rating', 'notes'];
  const types1 = transactionTypes.filter(type => title1.includes(type) || summary1.includes(type));
  const types2 = transactionTypes.filter(type => title2.includes(type) || summary2.includes(type));
  const sameTransactionType = types1.some(t => types2.includes(t));
  
  // Determine if duplicate
  let isDuplicate = false;
  let score = 0;
  let reason = '';
  
  if (sameCompany && sameAmount && sameTransactionType) {
    isDuplicate = true;
    score = 95;
    reason = 'Same company, amount, and transaction type';
  } else if (sameCompany && sameTransactionType && titleSimilarity > 0.6) {
    isDuplicate = true;
    score = 90;
    reason = 'Same company and transaction type with similar titles';
  } else if (titleSimilarity > 0.8 && sameTransactionType) {
    isDuplicate = true;
    score = 85;
    reason = 'Very similar titles and same transaction type';
  } else if (sameCompany && titleSimilarity > 0.7) {
    isDuplicate = true;
    score = 80;
    reason = 'Same company with very similar titles';
  }
  
  return { isDuplicate, score, reason };
}

function extractCompanyNames(text: string): string[] {
  // Look for capitalized words that are likely company names
  const words = text.split(/\s+/);
  const companies = [];
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[^\w]/g, '');
    
    // Check if it's a capitalized word that's not a common word
    if (word.length > 2 && word[0] === word[0].toUpperCase()) {
      const commonWords = ['the', 'and', 'or', 'for', 'in', 'on', 'at', 'to', 'from', 'with', 'by'];
      if (!commonWords.includes(word.toLowerCase())) {
        companies.push(word);
        
        // Check for multi-word company names
        if (i + 1 < words.length) {
          const nextWord = words[i + 1].replace(/[^\w]/g, '');
          if (nextWord.length > 2 && nextWord[0] === nextWord[0].toUpperCase()) {
            companies.push(word + ' ' + nextWord);
          }
        }
      }
    }
  }
  
  return companies;
}

function extractAmounts(text: string): number[] {
  const amounts = [];
  
  // Look for dollar amounts
  const dollarMatches = text.match(/\$[\d,]+(?:\.\d+)?[MBK]?/gi);
  if (dollarMatches) {
    for (const match of dollarMatches) {
      let amount = parseFloat(match.replace(/[$,]/g, ''));
      
      if (match.toUpperCase().includes('M')) {
        amount *= 1000000;
      } else if (match.toUpperCase().includes('B')) {
        amount *= 1000000000;
      } else if (match.toUpperCase().includes('K')) {
        amount *= 1000;
      }
      
      amounts.push(amount);
    }
  }
  
  // Look for written amounts
  const writtenMatches = text.match(/(\d+(?:\.\d+)?)\s*(million|billion|thousand)/gi);
  if (writtenMatches) {
    for (const match of writtenMatches) {
      const parts = match.split(/\s+/);
      let amount = parseFloat(parts[0]);
      const unit = parts[1].toLowerCase();
      
      if (unit.includes('million')) {
        amount *= 1000000;
      } else if (unit.includes('billion')) {
        amount *= 1000000000;
      } else if (unit.includes('thousand')) {
        amount *= 1000;
      }
      
      amounts.push(amount);
    }
  }
  
  return amounts;
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