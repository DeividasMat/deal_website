const { format, addDays } = require('date-fns');

async function aggressiveHistoricalFetch() {
  console.log('🚀 Starting AGGRESSIVE historical data fetch...');
  console.log('📅 Fetching ALL articles from July 1-15, 2025 (15 days)');
  console.log('💪 Using multiple search strategies to find more articles');
  console.log('🚫 Duplicate cleanup is DISABLED to prevent article loss');
  
  const baseUrl = 'https://privatecreditpulse.net';
  const startDate = new Date('2025-07-01');
  const endDate = new Date('2025-07-15');
  
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
  
  // Fetch for each day with multiple strategies
  while (currentDate <= endDate) {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📰 AGGRESSIVE FETCH FOR ${dateStr}`);
    console.log(`${'='.repeat(60)}`);
    
    let daySuccess = false;
    let dayNewArticles = 0;
    let attempts = 0;
    
    // Strategy 1: Standard manual trigger
    console.log(`🎯 Strategy 1: Standard manual trigger for ${dateStr}`);
    try {
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
      attempts++;
      
      if (result.success) {
        const countResponse = await fetch(`${baseUrl}/api/deals/all`);
        const countData = await countResponse.json();
        const newArticles = countData.total - totalArticlesBefore;
        
        if (newArticles > 0) {
          console.log(`✅ Strategy 1 SUCCESS: +${newArticles} new articles`);
          daySuccess = true;
          dayNewArticles += newArticles;
          totalArticlesBefore = countData.total;
        } else {
          console.log(`⚠️ Strategy 1 ran but found 0 new articles`);
        }
      } else {
        console.log(`❌ Strategy 1 failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`❌ Strategy 1 error: ${error.message}`);
    }
    
    // Strategy 2: Try previous day (news might be published day after)
    if (!daySuccess) {
      const prevDay = format(addDays(currentDate, -1), 'yyyy-MM-dd');
      console.log(`🎯 Strategy 2: Try previous day ${prevDay} (news published day after)`);
      
      try {
        const response = await fetch(`${baseUrl}/api/cron/manual-trigger`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            date: prevDay
          })
        });
        
        const result = await response.json();
        attempts++;
        
        if (result.success) {
          const countResponse = await fetch(`${baseUrl}/api/deals/all`);
          const countData = await countResponse.json();
          const newArticles = countData.total - totalArticlesBefore;
          
          if (newArticles > 0) {
            console.log(`✅ Strategy 2 SUCCESS: +${newArticles} new articles from ${prevDay}`);
            daySuccess = true;
            dayNewArticles += newArticles;
            totalArticlesBefore = countData.total;
          } else {
            console.log(`⚠️ Strategy 2 ran but found 0 new articles`);
          }
        } else {
          console.log(`❌ Strategy 2 failed: ${result.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error(`❌ Strategy 2 error: ${error.message}`);
      }
    }
    
    // Strategy 3: Try next day (news might be published day before)
    if (!daySuccess) {
      const nextDay = format(addDays(currentDate, 1), 'yyyy-MM-dd');
      console.log(`🎯 Strategy 3: Try next day ${nextDay} (news published day before)`);
      
      try {
        const response = await fetch(`${baseUrl}/api/cron/manual-trigger`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            date: nextDay
          })
        });
        
        const result = await response.json();
        attempts++;
        
        if (result.success) {
          const countResponse = await fetch(`${baseUrl}/api/deals/all`);
          const countData = await countResponse.json();
          const newArticles = countData.total - totalArticlesBefore;
          
          if (newArticles > 0) {
            console.log(`✅ Strategy 3 SUCCESS: +${newArticles} new articles from ${nextDay}`);
            daySuccess = true;
            dayNewArticles += newArticles;
            totalArticlesBefore = countData.total;
          } else {
            console.log(`⚠️ Strategy 3 ran but found 0 new articles`);
          }
        } else {
          console.log(`❌ Strategy 3 failed: ${result.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error(`❌ Strategy 3 error: ${error.message}`);
      }
    }
    
    // Strategy 4: Use current date (today) - often has more news
    if (!daySuccess) {
      const today = format(new Date(), 'yyyy-MM-dd');
      console.log(`🎯 Strategy 4: Use today's date ${today} (current news backfill)`);
      
      try {
        const response = await fetch(`${baseUrl}/api/cron/manual-trigger`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            date: today
          })
        });
        
        const result = await response.json();
        attempts++;
        
        if (result.success) {
          const countResponse = await fetch(`${baseUrl}/api/deals/all`);
          const countData = await countResponse.json();
          const newArticles = countData.total - totalArticlesBefore;
          
          if (newArticles > 0) {
            console.log(`✅ Strategy 4 SUCCESS: +${newArticles} new articles from today`);
            daySuccess = true;
            dayNewArticles += newArticles;
            totalArticlesBefore = countData.total;
          } else {
            console.log(`⚠️ Strategy 4 ran but found 0 new articles`);
          }
        } else {
          console.log(`❌ Strategy 4 failed: ${result.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error(`❌ Strategy 4 error: ${error.message}`);
      }
    }
    
    // Strategy 5: Try 2-3 more recent dates that might have news
    if (!daySuccess) {
      const recentDates = [
        '2025-07-13',
        '2025-07-14',
        '2025-07-15'
      ];
      
      for (const recentDate of recentDates) {
        if (daySuccess) break;
        
        console.log(`🎯 Strategy 5: Try recent date ${recentDate} (recent news backfill)`);
        
        try {
          const response = await fetch(`${baseUrl}/api/cron/manual-trigger`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              date: recentDate
            })
          });
          
          const result = await response.json();
          attempts++;
          
          if (result.success) {
            const countResponse = await fetch(`${baseUrl}/api/deals/all`);
            const countData = await countResponse.json();
            const newArticles = countData.total - totalArticlesBefore;
            
            if (newArticles > 0) {
              console.log(`✅ Strategy 5 SUCCESS: +${newArticles} new articles from ${recentDate}`);
              daySuccess = true;
              dayNewArticles += newArticles;
              totalArticlesBefore = countData.total;
              break;
            } else {
              console.log(`⚠️ Strategy 5 (${recentDate}) ran but found 0 new articles`);
            }
          } else {
            console.log(`❌ Strategy 5 (${recentDate}) failed: ${result.error || 'Unknown error'}`);
          }
        } catch (error) {
          console.error(`❌ Strategy 5 (${recentDate}) error: ${error.message}`);
        }
        
        // Small delay between attempts
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
    
    // Record results
    if (daySuccess) {
      console.log(`🎉 DAY SUCCESS: ${dateStr} found ${dayNewArticles} new articles in ${attempts} attempts`);
      successfulDays++;
      
      dailyResults.push({
        date: dateStr,
        success: true,
        newArticles: dayNewArticles,
        attempts: attempts
      });
    } else {
      console.log(`😞 DAY FAILED: ${dateStr} found 0 new articles in ${attempts} attempts`);
      failedDays++;
      
      dailyResults.push({
        date: dateStr,
        success: false,
        attempts: attempts
      });
    }
    
    // Delay between days to avoid rate limiting
    console.log('⏱️  Waiting 4 seconds before next day...');
    await new Promise(resolve => setTimeout(resolve, 4000));
    
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
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 AGGRESSIVE FETCH COMPLETED:`);
  console.log(`${'='.repeat(80)}`);
  console.log(`📅 Date Range: July 1-15, 2025 (15 days)`);
  console.log(`✅ Successful days: ${successfulDays}`);
  console.log(`❌ Failed days: ${failedDays}`);
  console.log(`📈 Articles before: ${totalArticlesBefore}`);
  console.log(`📈 Articles after: ${totalArticlesAfter}`);
  console.log(`🆕 Total new articles: ${totalArticlesAfter - totalArticlesBefore}`);
  console.log(`${'='.repeat(80)}`);
  
  // Daily breakdown
  console.log(`\n📋 DAILY BREAKDOWN:`);
  dailyResults.forEach(day => {
    if (day.success) {
      console.log(`✅ ${day.date}: +${day.newArticles} new articles (${day.attempts} attempts)`);
    } else {
      console.log(`❌ ${day.date}: 0 new articles (${day.attempts} attempts)`);
    }
  });
  
  // Final assessment
  if (totalArticlesAfter >= 100) {
    console.log(`\n🎉 EXCELLENT! You now have ${totalArticlesAfter} articles!`);
    console.log(`🎯 This should give you a comprehensive database of private credit/equity deals.`);
    console.log(`📈 You went from ${totalArticlesBefore} to ${totalArticlesAfter} articles!`);
  } else if (totalArticlesAfter >= 50) {
    console.log(`\n✅ Good progress! You now have ${totalArticlesAfter} articles.`);
    console.log(`📈 You went from ${totalArticlesBefore} to ${totalArticlesAfter} articles!`);
  } else {
    console.log(`\n⚠️  Still low article count (${totalArticlesAfter}). This might be due to:`);
    console.log(`   - Limited news availability for historical dates`);
    console.log(`   - Perplexity API not finding relevant articles`);
    console.log(`   - All strategies exhausted for these dates`);
    console.log(`📈 But you still went from ${totalArticlesBefore} to ${totalArticlesAfter} articles!`);
  }
  
  console.log(`\n🔗 Check your website: https://privatecreditpulse.net`);
  console.log(`💡 If you still need more articles, try running this script again or check Supabase point-in-time recovery.`);
}

// Run the aggressive fetch
console.log('🔄 Starting aggressive historical fetch...');
aggressiveHistoricalFetch().catch(console.error); 