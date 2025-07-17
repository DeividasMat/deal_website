#!/usr/bin/env node

/**
 * Demo script to test deal fetching and display sample data
 * Run with: node scripts/test-demo.js
 */

const { getDatabase } = require('../lib/database');
const { format, subDays } = require('date-fns');

async function addSampleDeal() {
  console.log('🔄 Adding sample deal to database...');
  
  const db = getDatabase();
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  
  const sampleDeal = {
    date: yesterday,
    title: 'Major Private Credit Fund Launches & Strategic Acquisitions',
    summary: `Key Private Credit Developments for ${yesterday}:

🏦 APOLLO GLOBAL MANAGEMENT
• Launched new $2.5B private credit fund targeting middle-market companies
• Focus on healthcare and technology sectors
• Expected first close Q1 2024

💼 BLACKSTONE CREDIT
• Announced strategic partnership with European lending platform
• $500M commitment to support SME lending across Europe
• Expands direct lending capabilities in key markets

🤝 KKR NORTH AMERICA FUND
• Completed $300M refinancing deal for manufacturing portfolio company
• Improved terms and extended maturity by 3 years
• Demonstrates continued access to favorable credit markets

📈 MARKET TRENDS
• Private credit AUM reached $1.4T globally
• Increased demand for alternative financing solutions
• Rising interest in ESG-focused credit strategies

🔮 OUTLOOK
• Strong pipeline for Q4 2024 fundraising
• Continued growth in direct lending market
• Increased competition for quality deals`,
    content: `Detailed market analysis shows robust private credit activity with several major developments:

Apollo Global Management has announced the launch of their latest private credit fund, targeting $2.5 billion in commitments. The fund will focus primarily on middle-market companies in the healthcare and technology sectors, areas that have shown resilient performance despite market volatility.

Blackstone Credit made strategic moves by partnering with a leading European lending platform, committing $500 million to support small and medium enterprise lending across European markets. This expansion demonstrates the firm's commitment to global diversification in their private credit portfolio.

KKR's North America Fund successfully completed a significant $300 million refinancing transaction for one of their manufacturing portfolio companies. The deal not only improved borrowing terms but also extended the maturity profile by three years, showcasing the current favorable credit environment.

Market data indicates that global private credit assets under management have reached $1.4 trillion, representing continued strong growth in the sector. There's increased institutional demand for alternative financing solutions, particularly from pension funds and insurance companies seeking yield in a challenging rate environment.

ESG-focused credit strategies are gaining particular traction, with several managers reporting strong investor interest in sustainable finance initiatives within their private credit offerings.

Looking ahead, industry experts anticipate a strong pipeline for Q4 2024 fundraising activities, though increased competition for quality deal flow remains a key challenge for managers across the space.`,
    source: 'Demo Data - Perplexity + OpenAI'
  };
  
  try {
    const dealId = await db.saveDeal(sampleDeal);
    console.log(`✅ Sample deal added successfully with ID: ${dealId}`);
    console.log(`📅 Date: ${sampleDeal.date}`);
    console.log(`📝 Title: ${sampleDeal.title}`);
    console.log('\n🌐 Now visit http://localhost:3000 to see the deal!');
  } catch (error) {
    console.error('❌ Error adding sample deal:', error);
  }
}

async function main() {
  console.log('🎯 Private Credit Deals - Demo Script');
  console.log('=====================================\n');
  
  console.log('This script adds sample deal data for testing purposes.');
  console.log('Once you have real API keys, the system will fetch live data.\n');
  
  await addSampleDeal();
  
  console.log('\n📋 Next Steps:');
  console.log('1. Get your API keys (see DEPLOYMENT.md)');
  console.log('2. Add them to .env.local file');
  console.log('3. Test real deal fetching');
  console.log('4. Deploy to Vercel for daily automation');
  
  process.exit(0);
}

if (require.main === module) {
  main().catch(console.error);
} 