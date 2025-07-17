#!/usr/bin/env node

const { format, subDays } = require('date-fns');

async function fetchNews(date) {
  const targetDate = date || format(subDays(new Date(), 1), 'yyyy-MM-dd');
  
  console.log(`🚀 Fetching news for ${targetDate}...`);
  
  try {
    const response = await fetch('http://localhost:3000/api/deals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'fetch',
        date: targetDate
      }),
    });

    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ Successfully fetched ${data.deals?.length || 0} articles for ${targetDate}`);
      
      // Show the articles
      if (data.deals && data.deals.length > 0) {
        console.log('\n📰 Articles found:');
        data.deals.forEach((deal, index) => {
          console.log(`${index + 1}. ${deal.title} (${deal.category})`);
        });
      }
    } else {
      console.error('❌ Failed to fetch news:', data.error || 'Unknown error');
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
}

// Get date from command line argument or use yesterday
const date = process.argv[2];
fetchNews(date); 