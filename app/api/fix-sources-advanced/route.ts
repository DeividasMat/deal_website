import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export async function POST() {
  console.log('🔧 Starting advanced source attribution fix using database URLs...');

  try {
    const db = getDatabase();
    const allDeals = await db.getAllDeals();
    
    console.log(`📊 Found ${allDeals.length} total articles to process`);
    
    let updatedCount = 0;
    const updatedArticles: any[] = [];
    
    for (const deal of allDeals) {
      // Target articles with generic sources that have source URLs
      const hasGenericSource = deal.source === 'Perplexity + OpenAI' || 
                              deal.source === 'Financial News' ||
                              deal.source === 'Financial Publications' ||
                              deal.source === 'Deal News' ||
                              deal.source === 'Financing News' ||
                              deal.source === 'Financial News Wire';
      
      if (!hasGenericSource || !deal.source_url || !deal.id) {
        continue;
      }
      
      // Extract publication name from source URL
      const extractedSource = extractPublicationFromUrl(deal.source_url);
      
      if (extractedSource && extractedSource !== deal.source) {
        console.log(`🔄 Updating article ${deal.id}: "${deal.title.substring(0, 50)}..."`);
        console.log(`   Source: "${deal.source}" → "${extractedSource}"`);
        console.log(`   URL: ${deal.source_url}`);
        
        await db.updateDealSourceUrl(
          deal.id, 
          deal.source_url, // Keep existing URL
          extractedSource  // Update source name
        );
        
        updatedArticles.push({
          id: deal.id,
          title: deal.title,
          oldSource: deal.source,
          newSource: extractedSource,
          sourceUrl: deal.source_url
        });
        
        updatedCount++;
      }
    }
    
    console.log(`✅ Updated ${updatedCount} articles with proper source attribution from URLs`);
    
    return NextResponse.json({
      success: true,
      message: `Successfully updated ${updatedCount} articles with source attribution from database URLs`,
      totalProcessed: allDeals.length,
      updated: updatedCount,
      unchanged: allDeals.length - updatedCount,
      updatedArticles: updatedArticles,
      examples: updatedArticles.slice(0, 5) // Show first 5 examples
    });

  } catch (error) {
    console.error('❌ Error fixing source attribution:', error);
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
    
    // Map domains to publication names
    const domainToPublication: { [key: string]: string } = {
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
      'www.commercialobserver.com': 'Commercial Observer',
      'commercialobserver.com': 'Commercial Observer',
      
      // Other Financial Media
      'www.marketwatch.com': 'MarketWatch',
      'marketwatch.com': 'MarketWatch',
      'www.cnbc.com': 'CNBC',
      'cnbc.com': 'CNBC',
      'finance.yahoo.com': 'Yahoo Finance',
      'www.investmentexecutive.com': 'Investment Executive',
      'investmentexecutive.com': 'Investment Executive',
      
      // Regional & Specialized
      'refreshmiami.com': 'Refresh Miami',
      'www.refreshmiami.com': 'Refresh Miami',
      'www.bioworld.com': 'BioWorld',
      'bioworld.com': 'BioWorld',
      'www.natlawreview.com': 'The National Law Review',
      'natlawreview.com': 'The National Law Review',
      
      // Alternative Sources
      'www.sagard.com': 'Sagard',
      'sagard.com': 'Sagard',
      'www.dakota.com': 'Dakota',
      'dakota.com': 'Dakota',
      'www.hamiltonlane.com': 'Hamilton Lane',
      'hamiltonlane.com': 'Hamilton Lane',
      'www.withintelligence.com': 'With Intelligence',
      'withintelligence.com': 'With Intelligence'
    };
    
    // Direct domain match
    if (domainToPublication[domain]) {
      return domainToPublication[domain];
    }
    
    // Check for subdomain matches
    for (const [domainPattern, publication] of Object.entries(domainToPublication)) {
      if (domain.endsWith(domainPattern)) {
        return publication;
      }
    }
    
    // Special patterns for specific URLs
    if (domain.includes('spglobal.com') && url.includes('/ratings/')) {
      return 'S&P Global Ratings';
    }
    
    if (domain.includes('moodys.com') && url.includes('ratings')) {
      return 'Moody\'s Ratings';
    }
    
    if (domain.includes('fitch') && url.includes('ratings')) {
      return 'Fitch Ratings';
    }
    
    // Fallback: try to extract publication name from domain
    const cleanDomain = domain.replace(/^www\./, '').replace(/\.com$/, '').replace(/\.co\.uk$/, '');
    const words = cleanDomain.split(/[.-]/);
    
    if (words.length > 0) {
      // Capitalize first word as fallback
      const fallbackName = words[0].charAt(0).toUpperCase() + words[0].slice(1);
      
      // Only return if it looks like a reasonable publication name
      if (fallbackName.length > 2 && fallbackName.length < 20) {
        return fallbackName;
      }
    }
    
    return null;
    
  } catch (error) {
    console.error('Error parsing URL:', url, error);
    return null;
  }
}

// GET endpoint to preview what would be updated
export async function GET() {
  try {
    const db = getDatabase();
    const allDeals = await db.getAllDeals();
    
    const candidates = allDeals.filter(deal => {
      const hasGenericSource = deal.source === 'Perplexity + OpenAI' || 
                              deal.source === 'Financial News' ||
                              deal.source === 'Financial Publications' ||
                              deal.source === 'Deal News' ||
                              deal.source === 'Financing News' ||
                              deal.source === 'Financial News Wire';
      
      return hasGenericSource && deal.source_url;
    });
    
    const preview = candidates.map(deal => ({
      id: deal.id,
      title: deal.title.substring(0, 50) + '...',
      currentSource: deal.source,
      sourceUrl: deal.source_url,
      suggestedSource: extractPublicationFromUrl(deal.source_url || ''),
      willUpdate: !!extractPublicationFromUrl(deal.source_url || '')
    }));
    
    return NextResponse.json({
      totalArticles: allDeals.length,
      candidatesForUpdate: candidates.length,
      willBeUpdated: preview.filter(p => p.willUpdate).length,
      preview: preview.slice(0, 10) // Show first 10
    });
    
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 