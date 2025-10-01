#!/usr/bin/env node

/**
 * Script to verify that Vercel cron jobs are properly configured
 * Run this after deployment to check if automatic fetching will work
 */

const https = require('https');

async function checkCronStatus() {
  console.log('🔍 Verifying Vercel Cron Job Setup\n');
  console.log('=' .repeat(50));
  
  // Check environment variables
  console.log('\n📋 Environment Variables Check:');
  console.log('-'.repeat(30));
  
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'PERPLEXITY_API_KEY',
    'OPENAI_API_KEY'
  ];
  
  const optionalEnvVars = [
    'CRON_SECRET',
    'VERCEL',
    'VERCEL_URL'
  ];
  
  let missingRequired = [];
  
  requiredEnvVars.forEach(varName => {
    if (process.env[varName]) {
      console.log(`✅ ${varName}: Set`);
    } else {
      console.log(`❌ ${varName}: MISSING (Required)`);
      missingRequired.push(varName);
    }
  });
  
  console.log('\n📋 Optional Variables:');
  console.log('-'.repeat(30));
  
  optionalEnvVars.forEach(varName => {
    if (process.env[varName]) {
      console.log(`✅ ${varName}: Set`);
    } else {
      console.log(`⚠️ ${varName}: Not set (Optional)`);
    }
  });
  
  if (missingRequired.length > 0) {
    console.log('\n❌ CRITICAL: Missing required environment variables!');
    console.log('Please set these in your Vercel dashboard:');
    console.log('1. Go to your Vercel project dashboard');
    console.log('2. Navigate to Settings → Environment Variables');
    console.log('3. Add the missing variables listed above');
    console.log('\nMissing variables:', missingRequired.join(', '));
    return false;
  }
  
  console.log('\n✅ All required environment variables are set!');
  
  // Instructions for Vercel
  console.log('\n📝 Vercel Cron Job Schedule:');
  console.log('-'.repeat(30));
  console.log('Daily News Collection:');
  console.log('  • 8:00 AM UTC (3:00 AM EST)');
  console.log('  • 12:00 PM UTC (7:00 AM EST)');
  console.log('  • 5:00 PM UTC (12:00 PM EST)');
  console.log('\nDuplicate Cleanup:');
  console.log('  • 5:30 PM UTC (12:30 PM EST)');
  
  console.log('\n🔧 To verify cron jobs are working:');
  console.log('-'.repeat(30));
  console.log('1. Go to Vercel Dashboard → Functions tab');
  console.log('2. Look for /api/cron/daily-news');
  console.log('3. Check "Invocations" to see if it\'s being triggered');
  console.log('4. If no invocations, check:');
  console.log('   • Is this a production deployment?');
  console.log('   • Are environment variables set?');
  console.log('   • Check Vercel logs for errors');
  
  console.log('\n💡 Manual Testing Commands:');
  console.log('-'.repeat(30));
  console.log('Test cron endpoint (replace YOUR_APP_URL):');
  console.log('curl https://YOUR_APP_URL.vercel.app/api/cron/daily-news');
  console.log('\nTrigger manual fetch:');
  console.log('curl -X POST https://YOUR_APP_URL.vercel.app/api/cron/manual-trigger');
  
  console.log('\n🚨 Common Issues & Fixes:');
  console.log('-'.repeat(30));
  console.log('1. Cron not triggering:');
  console.log('   • Ensure this is a PRODUCTION deployment');
  console.log('   • Cron jobs don\'t run on preview deployments');
  console.log('\n2. Authentication errors:');
  console.log('   • Set CRON_SECRET in Vercel environment variables');
  console.log('   • Use: openssl rand -hex 32 to generate');
  console.log('\n3. API timeouts:');
  console.log('   • Check maxDuration in vercel.json (currently 300s)');
  console.log('   • Consider reducing batch sizes');
  
  return true;
}

// Run the check
checkCronStatus().then(success => {
  if (success) {
    console.log('\n✅ Setup verification complete!');
  } else {
    console.log('\n❌ Setup issues detected. Please fix the issues above.');
    process.exit(1);
  }
});



