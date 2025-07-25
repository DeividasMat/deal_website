#!/usr/bin/env node
const https = require('https');
const http = require('http');

// Configuration
const BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://deal-website-nocxkuizo-deividasmats-projects.vercel.app'
  : 'http://localhost:3000';

const BATCH_SIZE = 5; // Process 5 articles at a time to avoid rate limits
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds between batches

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (error) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function enhanceArticles() {
  console.log('🚀 Starting article enhancement process...');
  console.log(`📡 Using API: ${BASE_URL}`);
  
  try {
    // First, get the total count
    console.log('📊 Getting total article count...');
    const countResponse = await makeRequest(`${BASE_URL}/api/enhance-articles`);
    
    if (countResponse.status !== 200) {
      throw new Error(`Failed to get article count: ${countResponse.status}`);
    }
    
    const totalDeals = countResponse.data.totalDeals;
    console.log(`📈 Found ${totalDeals} total articles to enhance`);
    
    let startId = 0;
    let totalProcessed = 0;
    let totalEnhanced = 0;
    let totalErrors = 0;
    
    while (startId < totalDeals) {
      console.log(`\n🔧 Processing batch starting at ${startId}...`);
      
      const response = await makeRequest(`${BASE_URL}/api/enhance-articles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          limit: BATCH_SIZE,
          startId: startId
        })
      });
      
      if (response.status !== 200) {
        console.error(`❌ Batch failed: ${response.status}`, response.data);
        break;
      }
      
      const result = response.data;
      totalProcessed += result.processed;
      totalEnhanced += result.enhanced;
      totalErrors += result.errors;
      
      console.log(`✅ Batch complete: ${result.enhanced}/${result.processed} enhanced`);
      console.log(`📊 Progress: ${totalProcessed}/${totalDeals} (${Math.round(totalProcessed/totalDeals*100)}%)`);
      
      startId = result.nextStartId;
      
      if (!result.hasMore) {
        console.log('🎉 All articles processed!');
        break;
      }
      
      // Delay between batches to avoid rate limits
      console.log(`⏳ Waiting ${DELAY_BETWEEN_BATCHES/1000}s before next batch...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
    
    console.log('\n📋 Final Summary:');
    console.log(`📊 Total Processed: ${totalProcessed}`);
    console.log(`✅ Successfully Enhanced: ${totalEnhanced}`);
    console.log(`❌ Errors: ${totalErrors}`);
    console.log(`📈 Success Rate: ${Math.round(totalEnhanced/totalProcessed*100)}%`);
    
  } catch (error) {
    console.error('💥 Enhancement process failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  enhanceArticles().catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
}

module.exports = { enhanceArticles }; 