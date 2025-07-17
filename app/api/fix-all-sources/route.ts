import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export async function POST() {
  console.log('🔧 Starting comprehensive source fix for ALL articles...');

  try {
    const db = getDatabase();
    const allDeals = await db.getAllDeals();
    
    console.log(`📊 Found ${allDeals.length} total articles to process`);
    
    let updatedCount = 0;
    const updatedArticles: any[] = [];
    const problemArticles: any[] = [];
    
    for (const deal of allDeals) {
      if (!deal.id) continue;
      
      // Target any article with generic/hardcoded sources
      const hasGenericSource = deal.source === 'Perplexity + OpenAI' || 
                              deal.source === 'Financial News' ||
                              deal.source === 'Financial Publications' ||
                              deal.source === 'Deal News' ||
                              deal.source === 'Financing News' ||
                              deal.source === 'Financial News Wire' ||
                              deal.source === 'Supabase Test';
      
      if (!hasGenericSource) {
        continue;
      }
      
      let extractedSource: string | null = null;
      let method = '';
      
      // Method 1: Extract from source URL if available
      if (deal.source_url) {
        extractedSource = extractPublicationFromUrl(deal.source_url);
        method = 'URL-based';
      }
      
      // Method 2: Extract from content if URL method failed
      if (!extractedSource && deal.content) {
        extractedSource = extractSourceFromContent(deal.content);
        method = 'Content-based';
      }
      
      // Method 3: Extract from summary if other methods failed
      if (!extractedSource && deal.summary) {
        extractedSource = extractSourceFromContent(deal.summary);
        method = 'Summary-based';
      }
      
      // Method 4: Infer from title/content patterns
      if (!extractedSource) {
        extractedSource = inferSourceFromTitle(deal.title, deal.summary);
        method = 'Pattern-based';
      }
      
      // Method 5: Last resort - assign based on category
      if (!extractedSource) {
        extractedSource = getDefaultSourceByCategory(deal.category || 'Market News');
        method = 'Category-based';
      }
      
      if (extractedSource && extractedSource !== deal.source) {
        console.log(`🔄 Updating article ${deal.id}: "${deal.title.substring(0, 50)}..."`);
        console.log(`   Method: ${method}`);
        console.log(`   Source: "${deal.source}" → "${extractedSource}"`);
        if (deal.source_url) console.log(`   URL: ${deal.source_url}`);
        
        await db.updateDealSourceUrl(
          deal.id, 
          deal.source_url || '', 
          extractedSource
        );
        
        updatedArticles.push({
          id: deal.id,
          title: deal.title,
          method: method,
          oldSource: deal.source,
          newSource: extractedSource,
          sourceUrl: deal.source_url || 'None'
        });
        
        updatedCount++;
      } else {
        // Track articles that couldn't be fixed
        problemArticles.push({
          id: deal.id,
          title: deal.title.substring(0, 50) + '...',
          source: deal.source,
          hasUrl: !!deal.source_url,
          url: deal.source_url || 'None'
        });
      }
    }
    
    console.log(`✅ Updated ${updatedCount} articles with proper source attribution`);
    console.log(`⚠️ ${problemArticles.length} articles still need manual review`);
    
    return NextResponse.json({
      success: true,
      message: `Comprehensive source fix completed: ${updatedCount} articles updated`,
      totalProcessed: allDeals.length,
      updated: updatedCount,
      stillNeedWork: problemArticles.length,
      updatedArticles: updatedArticles,
      problemArticles: problemArticles.slice(0, 5), // Show first 5 problem cases
      methodBreakdown: updatedArticles.reduce((acc: any, article) => {
        acc[article.method] = (acc[article.method] || 0) + 1;
        return acc;
      }, {}),
      examples: updatedArticles.slice(0, 10) // Show first 10 examples
    });

  } catch (error) {
    console.error('❌ Error in comprehensive source fix:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

function extractPublicationFromUrl(url: string): string | null {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase();
    
    // Comprehensive domain mapping
    const domainMap: { [key: string]: string } = {
      // Major Financial Publications
      'www.bloomberg.com': 'Bloomberg',
      'bloomberg.com': 'Bloomberg',
      'www.reuters.com': 'Reuters',
      'reuters.com': 'Reuters',
      'www.ft.com': 'Financial Times',
      'ft.com': 'Financial Times',
      'www.wsj.com': 'Wall Street Journal',
      'wsj.com': 'Wall Street Journal',
      
      // Rating Agencies
      'www.fitchratings.com': 'Fitch Ratings',
      'fitchratings.com': 'Fitch Ratings',
      'www.spglobal.com': 'S&P Global Ratings',
      'spglobal.com': 'S&P Global Ratings',
      'ratings.moodys.com': 'Moody\'s Ratings',
      'www.moodys.com': 'Moody\'s Ratings',
      'moodys.com': 'Moody\'s Ratings',
      'www.dbrs.com': 'Morningstar DBRS',
      'dbrs.com': 'Morningstar DBRS',
      
      // Press Release Services
      'www.prnewswire.com': 'PR Newswire',
      'prnewswire.com': 'PR Newswire',
      'www.globenewswire.com': 'GlobeNewswire',
      'globenewswire.com': 'GlobeNewswire',
      'www.businesswire.com': 'Business Wire',
      'businesswire.com': 'Business Wire',
      
      // Industry Publications
      'www.privatedebtinvestor.com': 'Private Debt Investor',
      'privatedebtinvestor.com': 'Private Debt Investor',
      'www.privateequityinternational.com': 'Private Equity International',
      'privateequityinternational.com': 'Private Equity International',
      'alternativecreditinvestor.com': 'Alternative Credit Investor',
      'www.abfjournal.com': 'ABF Journal',
      'abfjournal.com': 'ABF Journal',
      'www.crowdfundinsider.com': 'Crowdfund Insider',
      'crowdfundinsider.com': 'Crowdfund Insider',
      
      // Real Estate & Data
      'www.costar.com': 'CoStar',
      'costar.com': 'CoStar',
      
      // Other Sources
      'refreshmiami.com': 'Refresh Miami',
      'www.bioworld.com': 'BioWorld',
      'bioworld.com': 'BioWorld',
      'www.sagard.com': 'Sagard',
      'sagard.com': 'Sagard'
    };
    
    return domainMap[domain] || null;
    
  } catch (error) {
    return null;
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
      const source = match[1].trim().replace(/\([^)]*\)/g, '').trim();
      
      // Map common variations
      const sourceMap: { [key: string]: string } = {
        'pr newswire': 'PR Newswire',
        'globenewswire': 'GlobeNewswire',
        'bloomberg terminal': 'Bloomberg',
        'reuters': 'Reuters',
        'fitch ratings': 'Fitch Ratings',
        'fitch': 'Fitch Ratings',
        'moody\'s': 'Moody\'s Ratings',
        's&p global ratings': 'S&P Global Ratings',
        'costar': 'CoStar',
        'the investor': 'The Investor',
        'crowdfund insider': 'Crowdfund Insider',
        'abf journal': 'ABF Journal'
      };
      
      const normalized = source.toLowerCase();
      return sourceMap[normalized] || source;
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
  
  // Look for specific company mentions that indicate sources
  if (text.includes('announced') || text.includes('disclosed')) {
    return 'Company Press Release';
  }
  
  return null;
}

function getDefaultSourceByCategory(category: string): string {
  const categoryMap: { [key: string]: string } = {
    'Credit Facility': 'Lending News',
    'Fund Raising': 'Private Equity News',
    'M&A Financing': 'M&A News',
    'CLO/Securitization': 'Structured Finance News',
    'Credit Rating': 'Rating Agency Report',
    'Real Estate Credit': 'Real Estate Finance News',
    'Infrastructure Credit': 'Infrastructure Finance News',
    'Special Situations': 'Distressed Debt News',
    'Market News': 'Financial Markets News',
    'Deal Activity': 'Deal News'
  };
  
  return categoryMap[category] || 'Financial News';
}

// GET endpoint to preview what would be updated
export async function GET() {
  try {
    const db = getDatabase();
    const allDeals = await db.getAllDeals();
    
    const genericSources = allDeals.filter(deal => {
      return deal.source === 'Perplexity + OpenAI' || 
             deal.source === 'Financial News' ||
             deal.source === 'Financial Publications' ||
             deal.source === 'Deal News' ||
             deal.source === 'Financing News' ||
             deal.source === 'Financial News Wire' ||
             deal.source === 'Supabase Test';
    });
    
    const withUrls = genericSources.filter(deal => !!deal.source_url);
    const withoutUrls = genericSources.filter(deal => !deal.source_url);
    
    return NextResponse.json({
      totalArticles: allDeals.length,
      genericSources: genericSources.length,
      withUrls: withUrls.length,
      withoutUrls: withoutUrls.length,
      breakdown: {
        'Perplexity + OpenAI': allDeals.filter(d => d.source === 'Perplexity + OpenAI').length,
        'Financial News': allDeals.filter(d => d.source === 'Financial News').length,
        'Other Generic': allDeals.filter(d => ['Financial Publications', 'Deal News', 'Financing News', 'Financial News Wire', 'Supabase Test'].includes(d.source)).length
      },
      examples: genericSources.slice(0, 5).map(deal => ({
        id: deal.id,
        title: deal.title.substring(0, 50) + '...',
        source: deal.source,
        hasUrl: !!deal.source_url,
        url: deal.source_url || 'None'
      }))
    });
    
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 