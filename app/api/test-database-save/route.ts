import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
  try {
    console.log('🧪 Starting database save test...');
    
    // Show environment variables (safely)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hasKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    console.log('Environment:', {
      supabaseUrl: supabaseUrl?.substring(0, 50) + '...',
      hasKey,
      nodeEnv: process.env.NODE_ENV,
      vercel: !!process.env.VERCEL
    });
    
    if (!supabaseUrl || !hasKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing Supabase environment variables',
        supabaseUrl: supabaseUrl?.substring(0, 50) + '...',
        hasKey
      });
    }
    
    // Test 1: Check current database count
    const db = getDatabase();
    const beforeCount = await db.getAllDeals();
    console.log(`Current database has ${beforeCount.length} articles`);
    
    // Test 2: Direct Supabase client test
    const supabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    
    // Test what tables exist
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
    
    console.log('Available tables:', tables);
    
    // Test 3: Try to save a test article
    const testArticle = {
      date: new Date().toISOString().split('T')[0],
      title: 'DATABASE TEST: ' + new Date().toISOString(),
      summary: 'This is a test article to verify where data is being saved in Supabase',
      content: 'Test content for database verification',
      source: 'Database Test',
      source_url: 'https://example.com/test',
      category: 'Test'
    };
    
    console.log('Attempting to save test article...');
    const savedId = await db.saveDeal(testArticle);
    console.log(`Test article saved with ID: ${savedId}`);
    
    // Test 4: Verify it was saved
    const afterCount = await db.getAllDeals();
    console.log(`After save, database has ${afterCount.length} articles`);
    
    // Test 5: Direct query to deals table
    const { data: directQuery, error: queryError } = await supabase
      .from('deals')
      .select('count')
      .eq('title', testArticle.title);
    
    console.log('Direct query result:', directQuery, queryError);
    
    // Test 6: Get the newest articles
    const { data: newestArticles, error: newestError } = await supabase
      .from('deals')
      .select('id, title, date, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    return NextResponse.json({
      success: true,
      test_results: {
        environment: {
          supabaseUrl: supabaseUrl.substring(0, 50) + '...',
          hasKey,
          nodeEnv: process.env.NODE_ENV,
          vercel: !!process.env.VERCEL
        },
        available_tables: tables || [],
        table_error: tableError?.message,
        before_count: beforeCount.length,
        after_count: afterCount.length,
        saved_id: savedId,
        test_article: testArticle,
        direct_query: {
          data: directQuery,
          error: queryError?.message
        },
        newest_articles: newestArticles || [],
        newest_error: newestError?.message
      }
    });
    
  } catch (error) {
    console.error('Database test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Database test endpoint - POST to run test',
    purpose: 'Tests where data is actually being saved and helps debug Supabase discrepancy'
  });
} 