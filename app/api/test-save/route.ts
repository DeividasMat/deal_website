import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export async function GET() {
  try {
    const db = getDatabase();
    
    // Save a test article
    const testArticle = {
      date: '2025-06-27',
      title: 'TEST: Database Save Test ' + new Date().getTime(),
      summary: 'This is a test to verify database saving is working',
      content: 'Test content to verify the system works',
      source: 'Test Source',
      source_url: 'https://example.com/test',
      category: 'Test Category'
    };
    
    const savedId = await db.saveDeal(testArticle);
    
    // Get total count
    const allDeals = await db.getAllDeals();
    
    return NextResponse.json({
      success: true,
      message: 'Test article saved successfully',
      savedId,
      testTitle: testArticle.title,
      totalArticles: allDeals.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 