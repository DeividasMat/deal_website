import { NextResponse } from 'next/server';

export async function GET() {
  const cronSecret = process.env.CRON_SECRET;
  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return NextResponse.json({
    vercelEnvironment: !!process.env.VERCEL,
    cronScheduled: '0 17 * * * (5 PM UTC / 12 PM EST / 1 PM EDT)',
    cronEndpoint: '/api/cron/daily-news',
    environmentVariables: {
      CRON_SECRET: cronSecret ? '✅ Set' : '❌ Missing',
      PERPLEXITY_API_KEY: perplexityKey ? '✅ Set' : '❌ Missing',
      OPENAI_API_KEY: openaiKey ? '✅ Set' : '❌ Missing',
      SUPABASE_URL: supabaseUrl ? '✅ Set' : '❌ Missing',
      SUPABASE_ANON_KEY: supabaseKey ? '✅ Set' : '❌ Missing'
    },
    expectedBehavior: 'Fetches news for previous day at 5 PM UTC daily',
    troubleshooting: {
      missingCronSecret: 'Cron jobs will fail with 401 if CRON_SECRET not set',
      missingApiKeys: 'News fetching will fail if API keys missing',
      timezone: 'Cron runs at 17:00 UTC = 12:00 PM EST = 1:00 PM EDT'
    }
  });
} 