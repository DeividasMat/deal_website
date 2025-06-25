import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export async function POST() {
  console.log('🔧 Starting source attribution fix for all articles...');

  try {
    const db = getDatabase();
    const allDeals = await db.getAllDeals();
    
    console.log(`📊 Found ${allDeals.length} total articles to process`);
    
    let updatedCount = 0;
    
    for (const deal of allDeals) {
      // Skip if no ID or already has proper source (not generic "Perplexity + OpenAI")
      if (!deal.id || (deal.source !== 'Perplexity + OpenAI' && deal.source !== 'Financial News')) {
        continue;
      }
      
      // Extract source from content
      let extractedSource = extractSourceFromContent(deal.content || deal.summary);
      let extractedUrl = extractUrlFromContent(deal.content || deal.summary);
      
      // If we couldn't extract from content, try to infer from title/summary
      if (!extractedSource) {
        extractedSource = inferSourceFromTitle(deal.title, deal.summary);
      }
      
      if (extractedSource && extractedSource !== deal.source) {
        console.log(`🔄 Updating article ${deal.id}: "${deal.title.substring(0, 50)}..."`);
        console.log(`   Source: "${deal.source}" → "${extractedSource}"`);
        
        const finalUrl = extractedUrl || deal.source_url || '';
        await db.updateDealSourceUrl(
          deal.id!, 
          finalUrl, 
          extractedSource
        );
        
        updatedCount++;
      }
    }
    
    console.log(`✅ Updated ${updatedCount} articles with proper source attribution`);
    
    return NextResponse.json({
      success: true,
      message: `Successfully updated ${updatedCount} articles with proper source attribution`,
      totalProcessed: allDeals.length,
      updated: updatedCount,
      unchanged: allDeals.length - updatedCount
    });

  } catch (error) {
    console.error('❌ Error fixing source attribution:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

function extractSourceFromContent(content: string): string | null {
  if (!content) return null;
  
  // Look for "Source: [Publication]" patterns
  const sourcePatterns = [
    /Source:\s*([^|\n]+?)(?:\s*\||\n|$)/i,
    /Published by:\s*([^|\n]+?)(?:\s*\||\n|$)/i,
    /Via:\s*([^|\n]+?)(?:\s*\||\n|$)/i,
    /From:\s*([^|\n]+?)(?:\s*\||\n|$)/i
  ];
  
  for (const pattern of sourcePatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      const source = match[1].trim();
      
      // Clean up the source name
      if (source.includes('(')) {
        return source.split('(')[0].trim();
      }
      
      // Map common sources to standard names
      const sourceMap: { [key: string]: string } = {
        'pr newswire': 'PR Newswire',
        'globenewswire': 'GlobeNewswire', 
        'bloomberg terminal': 'Bloomberg Terminal',
        'bloomberg': 'Bloomberg',
        'reuters': 'Reuters',
        'financial times': 'Financial Times',
        'wall street journal': 'Wall Street Journal',
        'wsj': 'Wall Street Journal',
        'fitch ratings': 'Fitch Ratings',
        'fitch': 'Fitch Ratings',
        'moody\'s': 'Moody\'s Ratings',
        'moodys': 'Moody\'s Ratings',
        's&p global ratings': 'S&P Global Ratings',
        's&p': 'S&P Global Ratings',
        'morningstar dbrs': 'Morningstar DBRS',
        'crowdfund insider': 'Crowdfund Insider',
        'abf journal': 'ABF Journal',
        'costar': 'CoStar',
        'the investor': 'The Investor',
        'bioworld': 'BioWorld',
        'refresh miami': 'Refresh Miami',
        'alternative credit investor': 'Alternative Credit Investor',
        'private debt investor': 'Private Debt Investor',
        'private equity international': 'Private Equity International'
      };
      
      const lowerSource = source.toLowerCase();
      return sourceMap[lowerSource] || source;
    }
  }
  
  return null;
}

function extractUrlFromContent(content: string): string | null {
  if (!content) return null;
  
  // Look for URLs in the content
  const urlPatterns = [
    /https?:\/\/[^\s\)]+/g,
    /\[link\]\((https?:\/\/[^\)]+)\)/g
  ];
  
  for (const pattern of urlPatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      // Return the first valid URL found
      for (const url of matches) {
        if (url.includes('prnewswire.com') || 
            url.includes('globenewswire.com') ||
            url.includes('bloomberg.com') ||
            url.includes('reuters.com') ||
            url.includes('ft.com') ||
            url.includes('wsj.com') ||
            url.includes('fitchratings.com') ||
            url.includes('spglobal.com') ||
            url.includes('ratings.moodys.com')) {
          return url.replace(/[\[\]()]+/g, '');
        }
      }
      return matches[0].replace(/[\[\]()]+/g, '');
    }
  }
  
  return null;
}

function inferSourceFromTitle(title: string, summary: string): string | null {
  const text = (title + ' ' + summary).toLowerCase();
  
  // Look for rating agency mentions
  if (text.includes('fitch') && (text.includes('rating') || text.includes('rated'))) {
    return 'Fitch Ratings';
  }
  if (text.includes('moody') && (text.includes('rating') || text.includes('upgrade') || text.includes('downgrade'))) {
    return 'Moody\'s Ratings';
  }
  if (text.includes('s&p') && (text.includes('rating') || text.includes('upgrade') || text.includes('downgrade'))) {
    return 'S&P Global Ratings';
  }
  if (text.includes('morningstar') && text.includes('dbrs')) {
    return 'Morningstar DBRS';
  }
  
  // Look for publication-specific language patterns
  if (text.includes('announced') && text.includes('credit facility')) {
    return 'Financial News Wire';
  }
  if (text.includes('completed') && text.includes('acquisition')) {
    return 'Deal News';
  }
  if (text.includes('secured') && text.includes('financing')) {
    return 'Financing News';
  }
  
  return 'Financial Publications';
} 