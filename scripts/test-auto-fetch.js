#!/usr/bin/env node

/**
 * Test script to verify auto-fetch will work
 * Run this locally to test the logic before deployment
 */

const http = require('http');
const { format } = require('date-fns');

// Simulate the auto-fetch logic
class AutoFetchSimulator {
  constructor() {
    this.lastFetchTime = null;
    this.isFetching = false;
    this.fetchCount = 0;
  }

  shouldFetch() {
    const now = new Date();
    const threeHoursInMs = 3 * 60 * 60 * 1000;
    
    if (!this.lastFetchTime) {
      console.log('✅ Should fetch: No previous fetch recorded');
      return true;
    }
    
    const timeSinceLastFetch = now.getTime() - this.lastFetchTime.getTime();
    const shouldFetch = timeSinceLastFetch > threeHoursInMs;
    
    console.log(`⏰ Last fetch: ${this.lastFetchTime.toISOString()}`);
    console.log(`⏱️ Time since last fetch: ${Math.round(timeSinceLastFetch / 1000 / 60)} minutes`);
    console.log(`${shouldFetch ? '✅' : '❌'} Should fetch: ${shouldFetch ? 'Yes' : 'No'}`);
    
    return shouldFetch;
  }

  async simulateFetch() {
    if (this.isFetching) {
      console.log('⚠️ Already fetching, skipping...');
      return;
    }

    this.isFetching = true;
    this.fetchCount++;
    
    console.log(`\n🚀 Fetch #${this.fetchCount} starting...`);
    console.log('📅 Would fetch news for:', format(new Date(), 'yyyy-MM-dd'));
    
    // Simulate fetch delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    this.lastFetchTime = new Date();
    this.isFetching = false;
    
    console.log(`✅ Fetch #${this.fetchCount} completed at ${this.lastFetchTime.toISOString()}`);
  }

  async handlePageLoad() {
    console.log('\n👤 User visits website...');
    
    if (this.shouldFetch() && !this.isFetching) {
      await this.simulateFetch();
    } else if (this.isFetching) {
      console.log('📊 Fetch already in progress');
    } else {
      console.log('⏳ No fetch needed yet');
    }
  }
}

// Run simulation
async function runTest() {
  console.log('🧪 Testing Auto-Fetch Logic\n');
  console.log('=' .repeat(50));
  
  const simulator = new AutoFetchSimulator();
  
  // Test 1: First visit (should fetch)
  console.log('\n📝 Test 1: First user visit');
  await simulator.handlePageLoad();
  
  // Test 2: Visit after 1 minute (should not fetch)
  console.log('\n📝 Test 2: User visits after 1 minute');
  await new Promise(resolve => setTimeout(resolve, 1000));
  await simulator.handlePageLoad();
  
  // Test 3: Simulate 3+ hours passing
  console.log('\n📝 Test 3: User visits after 3+ hours');
  simulator.lastFetchTime = new Date(Date.now() - (3.5 * 60 * 60 * 1000));
  await simulator.handlePageLoad();
  
  // Test 4: Multiple simultaneous visits
  console.log('\n📝 Test 4: Multiple users visit simultaneously');
  simulator.lastFetchTime = new Date(Date.now() - (4 * 60 * 60 * 1000));
  await Promise.all([
    simulator.handlePageLoad(),
    simulator.handlePageLoad(),
    simulator.handlePageLoad()
  ]);
  
  console.log('\n' + '=' .repeat(50));
  console.log('✅ All tests completed!');
  console.log(`📊 Total fetches triggered: ${simulator.fetchCount}`);
  console.log('\n💡 Expected behavior in production:');
  console.log('  • First visitor after 3+ hours → Triggers fetch');
  console.log('  • Other visitors during fetch → See existing data');
  console.log('  • Fetch completes → All see new data');
  console.log('  • No unnecessary duplicate fetches');
}

// Test with actual API endpoint (optional)
async function testActualEndpoint() {
  console.log('\n🌐 Testing Actual Endpoint (if running locally)');
  console.log('=' .repeat(50));
  
  try {
    const response = await fetch('http://localhost:3000/api/auto-fetch');
    const data = await response.json();
    console.log('📡 Response from /api/auto-fetch:', data);
    
    if (data.status === 'fetching') {
      console.log('✅ Auto-fetch is working and fetching data!');
    } else if (data.lastFetch) {
      console.log(`✅ Last fetch was at: ${data.lastFetch}`);
      console.log(`📅 Next fetch at: ${data.nextFetch}`);
    }
  } catch (error) {
    console.log('⚠️ Could not connect to local endpoint (this is normal if not running locally)');
  }
}

// Run all tests
runTest().then(() => {
  console.log('\n🔍 Want to test with your local server?');
  console.log('1. Run: npm run dev');
  console.log('2. Run this script again');
  console.log('3. It will test the actual endpoint');
  
  // Uncomment to test actual endpoint
  // return testActualEndpoint();
}).catch(console.error);



