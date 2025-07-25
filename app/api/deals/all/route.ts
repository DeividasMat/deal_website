import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export async function GET() {
  try {
    const db = getDatabase();
    const deals = await db.getAllDeals();
    
    return NextResponse.json({ 
      deals,
      total: deals.length,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
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