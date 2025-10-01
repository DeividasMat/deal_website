#!/usr/bin/env node

/**
 * Test script to verify database data is showing on website
 */

const https = require('https');

async function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function testDatabaseDisplay() {
  console.log('🧪 Testing Database Display on Website\n');
  console.log('=' .repeat(60));
  
  const url = 'https://privatecreditpulse.net/api/deals/all';
  
  console.log('\n📡 Fetching data from:', url);
  console.log('⏱️ Timestamp:', new Date().toISOString());
  
  try {
    const result = await fetch(url);
    
    console.log('\n📊 API Response:');
    console.log('  Status Code:', result.status);
    
    if (result.status === 200 && result.data.deals) {
      const deals = result.data.deals;
      console.log('  Total Deals:', deals.length);
      console.log('  Fetch Time:', result.data.timestamp);
      
      if (deals.length > 0) {
        console.log('\n✅ DATA FOUND IN API!\n');
        
        // Group by date
        const byDate = {};
        deals.forEach(deal => {
          if (!byDate[deal.date]) {
            byDate[deal.date] = [];
          }
          byDate[deal.date].push(deal);
        });
        
        const dates = Object.keys(byDate).sort().reverse();
        
        console.log('📅 Articles by Date:');
        console.log('-'.repeat(60));
        dates.slice(0, 10).forEach(date => {
          console.log(`  ${date}: ${byDate[date].length} articles`);
        });
        
        console.log('\n📰 Latest 5 Articles:');
        console.log('-'.repeat(60));
        deals.slice(0, 5).forEach((deal, i) => {
          console.log(`\n  ${i + 1}. ${deal.title.substring(0, 60)}...`);
          console.log(`     Date: ${deal.date}`);
          console.log(`     Source: ${deal.source}`);
          console.log(`     Created: ${deal.created_at}`);
        });
        
        // Check for recent data
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];
        
        const recentDates = [today, yesterday, twoDaysAgo];
        const recentArticles = deals.filter(d => recentDates.includes(d.date));
        
        console.log('\n📊 Recent Data Analysis:');
        console.log('-'.repeat(60));
        console.log(`  Today (${today}): ${deals.filter(d => d.date === today).length} articles`);
        console.log(`  Yesterday (${yesterday}): ${deals.filter(d => d.date === yesterday).length} articles`);
        console.log(`  2 days ago (${twoDaysAgo}): ${deals.filter(d => d.date === twoDaysAgo).length} articles`);
        console.log(`  Last 3 days total: ${recentArticles.length} articles`);
        
        if (recentArticles.length === 0) {
          console.log('\n⚠️ WARNING: No articles from last 3 days!');
          console.log('  This means automatic fetching is not working.');
          console.log('  Solution: Set up cron-job.org as described in EASY_CRON_SETUP.md');
        } else {
          console.log('\n✅ Recent data found - automatic fetching is working!');
        }
        
        // Check oldest data
        const oldestDate = dates[dates.length - 1];
        console.log(`\n  Oldest article date: ${oldestDate}`);
        
        if (oldestDate.startsWith('2024-07')) {
          console.log('  ⚠️ Oldest data is from July - this is expected');
        }
        
      } else {
        console.log('\n❌ NO DEALS FOUND');
        console.log('  The database is empty or query returned no results');
        console.log('  Solution: Run manual fetch to add data');
      }
      
      console.log('\n' + '=' .repeat(60));
      console.log('✅ Test complete!');
      console.log('\n💡 Next Steps:');
      console.log('  1. After this deployment, visit: https://privatecreditpulse.net');
      console.log('  2. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)');
      console.log('  3. Data should now display correctly');
      console.log('  4. Set up cron-job.org for automatic daily updates');
      
    } else {
      console.log('\n❌ ERROR: Unexpected response');
      console.log('Response:', JSON.stringify(result.data, null, 2));
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('  Could not connect to API');
    console.error('  Make sure the website is deployed and accessible');
  }
}

testDatabaseDisplay();
