import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export async function GET() {
  try {
    const db = getDatabase();
    const deals = await db.getAllDeals();
    
    // Add debug logging
    console.log(`🔄 API: Fetching ${deals.length} deals at ${new Date().toISOString()}`);
    console.log(`🎯 Latest deal date: ${deals.length > 0 ? deals[0]?.date : 'No deals'}`);
    
    // Generate unique timestamp for cache busting
    const timestamp = Date.now();
    
    return NextResponse.json({ 
      deals,
      total: deals.length,
      timestamp: new Date().toISOString(),
      fetchTime: timestamp
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Last-Modified': new Date().toUTCString(),
        'ETag': `"${timestamp}"`,
        'Vary': '*'
      }
    });
  } catch (error) {
    console.error('Error fetching all deals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deals' },
      { status: 500 }
    );
  }
} 