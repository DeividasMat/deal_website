const { format, addDays } = require('date-fns');

async function comprehensiveHistoricalFetch() {
  console.log('🚀 Starting comprehensive historical data fetch...');
  console.log('📅 Fetching ALL articles from July 1-15, 2025 (15 days)');
  console.log('🚫 Duplicate cleanup is DISABLED to prevent article loss');
  
  const baseUrl = 'https://privatecreditpulse.net';
  const startDate = new Date('2025-07-01'); // July 1, 2025
  const endDate = new Date('2025-07-15');   // July 15, 2025
  
  let currentDate = startDate;
  let totalArticlesBefore = 0;
  let totalArticlesAfter = 0;
  let successfulDays = 0;
  let failedDays = 0;
  let dailyResults = [];
  
  // Get initial count
  try {
    const initialResponse = await fetch(`${baseUrl}/api/deals/all`);
    const initialData = await initialResponse.json();
    totalArticlesBefore = initialData.total;
    console.log(`📊 Starting with ${totalArticlesBefore} articles in database`);
  } catch (error) {
    console.error('❌ Error getting initial count:', error.message);
  }
  
  // Fetch for each day
  while (currentDate <= endDate) {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    
    try {
      console.log(`\n📰 Fetching news for ${dateStr}...`);
      
      const response = await fetch(`${baseUrl}/api/cron/manual-trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: dateStr
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Successfully fetched news for ${dateStr}`);
        successfulDays++;
        
        // Check how many articles we have now
        const countResponse = await fetch(`${baseUrl}/api/deals/all`);
        const countData = await countResponse.json();
        const currentTotal = countData.total;
        const newArticles = currentTotal - totalArticlesBefore;
        
        console.log(`📊 Current total articles: ${currentTotal} (+${newArticles} new)`);
        
        dailyResults.push({
          date: dateStr,
          success: true,
          totalArticles: currentTotal,
          newArticles: newArticles
        });
        
        totalArticlesBefore = currentTotal;
        
        // Delay to avoid rate limiting
        console.log('⏱️  Waiting 3 seconds to avoid rate limits...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        console.log(`❌ Failed to fetch news for ${dateStr}: ${result.error || result.message || 'Unknown error'}`);
        failedDays++;
        
        dailyResults.push({
          date: dateStr,
          success: false,
          error: result.error || result.message || 'Unknown error'
        });
      }
    } catch (error) {
      console.error(`❌ Error fetching news for ${dateStr}:`, error.message);
      failedDays++;
      
      dailyResults.push({
        date: dateStr,
        success: false,
        error: error.message
      });
    }
    
    // Move to next day
    currentDate = addDays(currentDate, 1);
  }
  
  // Get final count
  try {
    const finalResponse = await fetch(`${baseUrl}/api/deals/all`);
    const finalData = await finalResponse.json();
    totalArticlesAfter = finalData.total;
  } catch (error) {
    console.error('❌ Error getting final count:', error.message);
  }
  
  // Summary Report
  console.log(`\n📊 COMPREHENSIVE FETCH COMPLETED:`);
  console.log(`='`.repeat(50));
  console.log(`📅 Date Range: July 1-15, 2025 (15 days)`);
  console.log(`✅ Successful days: ${successfulDays}`);
  console.log(`❌ Failed days: ${failedDays}`);
  console.log(`📈 Articles before: ${totalArticlesBefore}`);
  console.log(`📈 Articles after: ${totalArticlesAfter}`);
  console.log(`🆕 Total new articles: ${totalArticlesAfter - totalArticlesBefore}`);
  console.log(`='`.repeat(50));
  
  // Daily breakdown
  console.log(`\n📋 DAILY BREAKDOWN:`);
  dailyResults.forEach(day => {
    if (day.success) {
      console.log(`✅ ${day.date}: ${day.totalArticles} total articles (+${day.newArticles} new)`);
    } else {
      console.log(`❌ ${day.date}: FAILED - ${day.error}`);
    }
  });
  
  if (totalArticlesAfter >= 100) {
    console.log(`\n🎉 EXCELLENT! You now have ${totalArticlesAfter} articles!`);
    console.log(`🎯 This should give you a comprehensive database of private credit/equity deals.`);
  } else if (totalArticlesAfter >= 50) {
    console.log(`\n✅ Good progress! You now have ${totalArticlesAfter} articles.`);
  } else {
    console.log(`\n⚠️  Still low article count (${totalArticlesAfter}). This might be due to:`);
    console.log(`   - Limited news availability for some dates`);
    console.log(`   - API rate limiting`);
    console.log(`   - Perplexity not finding relevant articles for certain dates`);
  }
  
  console.log(`\n🔗 Check your website: https://privatecreditpulse.net`);
}

// Run the comprehensive fetch
console.log('🔄 Starting comprehensive historical fetch...');
comprehensiveHistoricalFetch().catch(console.error); 