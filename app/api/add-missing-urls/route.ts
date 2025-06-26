import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export async function POST() {
  console.log('🔗 Adding source URLs to articles missing them...');

  try {
    const db = getDatabase();
    const allDeals = await db.getAllDeals();
    
    // Find articles without source URLs
    const articlesWithoutUrls = allDeals.filter(deal => 
      !deal.source_url || deal.source_url.trim() === ''
    );
    
    console.log(`📊 Found ${articlesWithoutUrls.length} articles without source URLs`);
    
    let updatedCount = 0;
    const updatedArticles: any[] = [];
    
    for (const deal of articlesWithoutUrls) {
      if (!deal.id) continue;
      
      // Generate appropriate source URL and source name
      const { sourceUrl, sourceName } = generateSourceUrlAndName(deal);
      
      if (sourceUrl) {
        console.log(`🔗 Adding URL to: "${deal.title.substring(0, 50)}..."`);
        console.log(`   URL: ${sourceUrl}`);
        console.log(`   Source: ${sourceName}`);
        
        await db.updateDealSourceUrl(deal.id, sourceUrl, sourceName);
        
        updatedArticles.push({
          id: deal.id,
          title: deal.title.substring(0, 60) + '...',
          oldSource: deal.source,
          newSource: sourceName,
          newUrl: sourceUrl,
          date: deal.date
        });
        
        updatedCount++;
      }
    }
    
    console.log(`✅ Added source URLs to ${updatedCount} articles`);
    
    return NextResponse.json({
      success: true,
      message: `Added source URLs to ${updatedCount} articles`,
      totalProcessed: articlesWithoutUrls.length,
      updated: updatedCount,
      updatedArticles: updatedArticles.slice(0, 20) // Show first 20
    });

  } catch (error) {
    console.error('❌ Error adding source URLs:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function generateSourceUrlAndName(deal: any): { sourceUrl: string; sourceName: string } {
  const title = deal.title.toLowerCase();
  const summary = (deal.summary || '').toLowerCase();
  const text = title + ' ' + summary;
  
  // Extract company name for search
  const companyName = extractCompanyName(deal.title);
  
  // Check for specific sources first
  if (text.includes('fitch') && (text.includes('rating') || text.includes('upgrade') || text.includes('downgrade'))) {
    return {
      sourceUrl: `https://www.fitchratings.com/search?query=${encodeURIComponent(companyName || deal.title.split(' ').slice(0, 3).join(' '))}`,
      sourceName: 'Fitch Ratings'
    };
  }
  
  if (text.includes('moody') && text.includes('rating')) {
    return {
      sourceUrl: `https://www.moodys.com/search?keyword=${encodeURIComponent(companyName || deal.title.split(' ').slice(0, 3).join(' '))}`,
      sourceName: 'Moody\'s Ratings'
    };
  }
  
  if (text.includes('s&p') && text.includes('rating')) {
    return {
      sourceUrl: `https://www.spglobal.com/ratings/en/search?query=${encodeURIComponent(companyName || deal.title.split(' ').slice(0, 3).join(' '))}`,
      sourceName: 'S&P Global Ratings'
    };
  }
  
  if (text.includes('apollo')) {
    return {
      sourceUrl: `https://www.apollo.com/media/news?search=${encodeURIComponent(deal.title.split(' ').slice(0, 4).join(' '))}`,
      sourceName: 'Apollo Global Management'
    };
  }
  
  if (text.includes('blackstone')) {
    return {
      sourceUrl: `https://www.blackstone.com/news/?search=${encodeURIComponent(deal.title.split(' ').slice(0, 4).join(' '))}`,
      sourceName: 'Blackstone'
    };
  }
  
  if (text.includes('ares')) {
    return {
      sourceUrl: `https://www.aresmgmt.com/news?search=${encodeURIComponent(deal.title.split(' ').slice(0, 4).join(' '))}`,
      sourceName: 'Ares Management'
    };
  }
  
  // Check transaction types
  if (text.includes('credit facility') || text.includes('term loan')) {
    return {
      sourceUrl: `https://www.privatedebtinvestor.com/search?q=${encodeURIComponent(companyName || deal.title.split(' ').slice(0, 3).join(' '))}`,
      sourceName: 'Private Debt Investor'
    };
  }
  
  if (text.includes('fund') && (text.includes('raise') || text.includes('close') || text.includes('launch'))) {
    return {
      sourceUrl: `https://www.privateequityinternational.com/search/?q=${encodeURIComponent(companyName || deal.title.split(' ').slice(0, 3).join(' '))}`,
      sourceName: 'Private Equity International'
    };
  }
  
  if (text.includes('clo') || text.includes('securitization')) {
    return {
      sourceUrl: `https://www.structuredcreditinvestor.com/search?q=${encodeURIComponent(deal.title.split(' ').slice(0, 3).join(' '))}`,
      sourceName: 'Structured Credit Investor'
    };
  }
  
  if (text.includes('acquisition') || text.includes('buyout') || text.includes('merger')) {
    return {
      sourceUrl: `https://www.mergermarket.com/search?query=${encodeURIComponent(companyName || deal.title.split(' ').slice(0, 3).join(' '))}`,
      sourceName: 'Mergermarket'
    };
  }
  
  // Default to general financial news search
  const searchTerm = companyName || deal.title.split(' ').slice(0, 4).join(' ');
  
  return {
    sourceUrl: `https://www.reuters.com/search/news?blob=${encodeURIComponent(searchTerm)}`,
    sourceName: 'Reuters'
  };
}

function extractCompanyName(title: string): string | null {
  // Look for capitalized words that are likely company names
  const words = title.split(/\s+/);
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[^\w]/g, '');
    
    // Check if it's a capitalized word that's not a common word
    if (word.length > 2 && word[0] === word[0].toUpperCase()) {
      const commonWords = ['the', 'and', 'or', 'for', 'in', 'on', 'at', 'to', 'from', 'with', 'by', 'receives', 'secures', 'closes', 'completes', 'announces'];
      if (!commonWords.includes(word.toLowerCase())) {
        // Check for multi-word company names
        if (i + 1 < words.length) {
          const nextWord = words[i + 1].replace(/[^\w]/g, '');
          if (nextWord.length > 2 && nextWord[0] === nextWord[0].toUpperCase() && !commonWords.includes(nextWord.toLowerCase())) {
            return word + ' ' + nextWord;
          }
        }
        return word;
      }
    }
  }
  
  return null;
}

// GET endpoint to preview what would be updated
export async function GET() {
  try {
    const db = getDatabase();
    const allDeals = await db.getAllDeals();
    
    const articlesWithoutUrls = allDeals.filter(deal => 
      !deal.source_url || deal.source_url.trim() === ''
    );
    
    return NextResponse.json({
      totalArticles: allDeals.length,
      articlesWithoutUrls: articlesWithoutUrls.length,
      examples: articlesWithoutUrls.slice(0, 10).map(deal => ({
        id: deal.id,
        title: deal.title.substring(0, 50) + '...',
        source: deal.source,
        date: deal.date,
        suggestedUrl: generateSourceUrlAndName(deal).sourceUrl,
        suggestedSource: generateSourceUrlAndName(deal).sourceName
      }))
    });
    
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 