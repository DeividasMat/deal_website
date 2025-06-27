import { NextResponse } from 'next/server';
import { getSupabaseDatabase } from '@/lib/supabase';

export async function GET() {
  try {
    const db = getSupabaseDatabase();
    const testResult = await db.testConnection();

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'supabase',
        supabase: 'configured',
        perplexity: 'configured',
        openai: 'configured'
      },
      supabaseTest: testResult,
      readyToSaveNews: testResult.success,
      environment: {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        nodeEnv: process.env.NODE_ENV,
        isVercel: !!process.env.VERCEL
      }
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 