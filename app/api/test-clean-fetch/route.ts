import { NextResponse } from 'next/server';
import { PerplexityService } from '@/lib/perplexity';
import { OpenAIService } from '@/lib/openai';

export async function POST() {
  console.log('🧪 Testing clean news fetch with improved processing...');

  const perplexityService = new PerplexityService();
  const openaiService = new OpenAIService();

  try {
    console.log('📊 Fetching fresh news from Perplexity...');
    
    // Fetch news for June 23, 2024
    const newsContent = await perplexityService.searchPrivateCreditDeals('2024-06-23');
    
    if (!newsContent) {
      return NextResponse.json({
        success: false,
        message: 'No news content found'
      });
    }

    console.log(`📄 Raw content length: ${newsContent.length}`);
    console.log(`📄 Content preview: ${newsContent.substring(0, 500)}...`);

    // Process with improved OpenAI
    const articles = await openaiService.extractNewsArticles(newsContent, 'Test Fetch');
    
    console.log(`✅ Generated ${articles.length} articles with improved processing`);
    
    // Log each article for verification
    articles.forEach((article, index) => {
      console.log(`\n📰 Article ${index + 1}:`);
      console.log(`Title: ${article.title}`);
      console.log(`Category: ${article.category}`);
      console.log(`Summary: ${article.summary}`);
      console.log(`Source: ${article.original_source}`);
      console.log(`URL: ${article.source_url}`);
      console.log('---');
    });

    return NextResponse.json({
      success: true,
      message: `Generated ${articles.length} articles with improved processing`,
      rawContentLength: newsContent.length,
      articles: articles,
      categoryCounts: articles.reduce((acc: any, article) => {
        acc[article.category] = (acc[article.category] || 0) + 1;
        return acc;
      }, {}),
      improvements: {
        'Specific Titles': articles.map(a => a.title.length > 40).filter(Boolean).length + ' out of ' + articles.length + ' have detailed titles',
        'Proper Categories': Object.keys(articles.reduce((acc: any, article) => {
          acc[article.category] = true;
          return acc;
        }, {})),
        'Source Attribution': articles.filter(a => a.original_source && a.original_source !== 'Financial News').length + ' articles have specific sources',
        'Working URLs': articles.filter(a => a.source_url && a.source_url.startsWith('http')).length + ' articles have URLs'
      }
    });

  } catch (error) {
    console.error('❌ Error testing clean fetch:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
} 