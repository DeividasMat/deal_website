import { NextResponse } from 'next/server';
import { getSupabaseDatabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Test environment variables
    const supabaseConfigured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const perplexityConfigured = !!process.env.PERPLEXITY_API_KEY;
    const openaiConfigured = !!process.env.OPENAI_API_KEY;

    let supabaseTest = { success: false, message: 'Not configured', tableCount: 0 };
    
    // Only test Supabase if it's configured
    if (supabaseConfigured) {
      try {
        const db = getSupabaseDatabase();
        const result = await db.testConnection();
        supabaseTest = {
          success: result.success,
          message: result.message,
          tableCount: result.tableCount || 0
        };
      } catch (error) {
        supabaseTest = { 
          success: false, 
          message: error instanceof Error ? error.message : 'Connection failed',
          tableCount: 0
        };
      }
    }

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'supabase',
        supabase: supabaseConfigured ? 'configured' : 'missing',
        perplexity: perplexityConfigured ? 'configured' : 'missing',
        openai: openaiConfigured ? 'configured' : 'missing'
      },
      supabaseTest: supabaseTest,
      readyToSaveNews: supabaseTest.success && perplexityConfigured && openaiConfigured
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 