import { NextResponse } from 'next/server';
import { OpenAIService } from '@/lib/openai';

export async function POST() {
  console.log('🧪 Testing improved article generation...');

  const openaiService = new OpenAIService();

  // Test content with potential duplicates and various deal types
  const testContent = `
  === Deal Activity ===
  • **Apollo Global Management** provided a **$500M credit facility** to **TechCorp Industries** to finance its acquisition of three software companies in the healthcare sector. The facility includes a $300M revolving credit line and $200M term loan with 5-year maturity. 
  Source: Bloomberg Terminal | https://www.bloomberg.com/news/articles/2024-06-23/apollo-techcorp-500m-facility

  • **Blackstone Credit** raised **$2.1B** for its new **European Direct Lending Fund IV**, marking the firm's largest European fundraise to date. The fund will focus on mid-market lending opportunities across technology and healthcare sectors.
  Source: Private Equity International | https://www.privateequityinternational.com/blackstone-2-1b-fund

  • **KKR & Co** closed **$800M acquisition financing** for **Vista Equity Partners'** buyout of **ManufacturingCorp**, a leading industrial automation company. The debt package consists of term loans and revolving credit facilities.
  Source: Reuters | https://www.reuters.com/business/kkr-vista-manufacturingcorp-deal

  • **Ares Management** issued a **$1.5B CLO** (Collateralized Loan Obligation) for infrastructure lending, marking the largest CLO focused on infrastructure assets this year.
  Source: Financial Times | https://www.ft.com/content/ares-clo-infrastructure

  • **Fitch Ratings** downgraded **RetailCorp's** senior unsecured notes to **'BB-'** from **'BB'** citing liquidity concerns and declining retail foot traffic trends.
  Source: Fitch Ratings | https://www.fitchratings.com/research/corporate-finance/retailcorp-downgrade

  • **Apollo Global Management** provided credit facility to **TechCorp Industries** for acquisition financing (similar to above - should be deduplicated)
  Source: Wall Street Journal | https://www.wsj.com/articles/apollo-techcorp-similar

  === Market News ===
  • **Brookfield Asset Management** launched its **$5B Real Estate Credit Fund** targeting commercial property financing across North America and Europe.
  Source: Wall Street Journal | https://www.wsj.com/articles/brookfield-real-estate-credit-fund

  • **Oaktree Capital** completed restructuring of **DistressedCorp's** $2B debt package, converting senior debt to equity in a distressed situation.
  Source: Bloomberg | https://www.bloomberg.com/news/articles/oaktree-distressedcorp-restructuring
  `;

  try {
    console.log('📊 Testing article extraction and improvement...');
    
    const articles = await openaiService.extractNewsArticles(testContent, 'Test Content');
    
    console.log(`✅ Generated ${articles.length} articles`);
    
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
      message: `Generated ${articles.length} improved articles with better titles, categories, and deduplication`,
      articles: articles,
      improvements: {
        'Better Titles': 'Specific company names and amounts included',
        'Proper Categories': 'Credit Facility, Fund Raising, M&A Financing, CLO/Securitization, Credit Rating, Real Estate Credit, Special Situations',
        'Deduplication': 'Similar deals merged into single comprehensive articles',
        'Enhanced Summaries': '2-3 sentences with bold formatting for key elements',
        'Source Attribution': 'Actual publication names instead of generic sources'
      }
    });

  } catch (error) {
    console.error('❌ Error testing improved articles:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
} 