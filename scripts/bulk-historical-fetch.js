const { format, subDays } = require('date-fns');

async function bulkFetchHistoricalData() {
  console.log('🚀 Starting bulk historical data fetch...');
  
  const baseUrl = 'https://privatecreditpulse.net';
  const startDate = new Date();
  const days = 30; // Fetch last 30 days
  
  console.log(`📅 Fetching data for ${days} days starting from ${format(startDate, 'yyyy-MM-dd')}`);
  
  let totalArticles = 0;
  let successfulDays = 0;
  let failedDays = 0;
  
  for (let i = 0; i < days; i++) {
    const targetDate = subDays(startDate, i);
    const dateStr = format(targetDate, 'yyyy-MM-dd');
    
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
        
        console.log(`📊 Current total articles: ${currentTotal}`);
        totalArticles = currentTotal;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.log(`❌ Failed to fetch news for ${dateStr}: ${result.error || 'Unknown error'}`);
        failedDays++;
      }
    } catch (error) {
      console.error(`❌ Error fetching news for ${dateStr}:`, error.message);
      failedDays++;
    }
  }
  
  console.log(`\n📊 Bulk fetch completed:`);
  console.log(`✅ Successful days: ${successfulDays}`);
  console.log(`❌ Failed days: ${failedDays}`);
  console.log(`📈 Total articles in database: ${totalArticles}`);
  
  if (totalArticles > 100) {
    console.log(`🎉 Great! You now have ${totalArticles} articles - much better than the 5 you started with!`);
  } else {
    console.log(`⚠️  Still low article count. You may need to check the Supabase dashboard for point-in-time recovery.`);
  }
}

// Run the bulk fetch
bulkFetchHistoricalData().catch(console.error); 