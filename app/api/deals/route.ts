import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { getScheduler } from '@/lib/scheduler';
import { format, subDays } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    
    const db = getDatabase();
    
    if (date) {
      // Get deals for specific date
      const deals = await db.getDealsByDate(date);
      return NextResponse.json({ deals, date });
    } else {
      // Get all available dates
      const dates = await db.getAvailableDates();
      return NextResponse.json({ dates });
    }
  } catch (error) {
    console.error('Error fetching deals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deals' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, date } = body;
    
    if (action === 'fetch') {
      const scheduler = getScheduler();
      const targetDate = date || format(subDays(new Date(), 1), 'yyyy-MM-dd');
      
      // Run manual fetch
      await scheduler.runManualFetch(targetDate);
      
      // Get the newly fetched deals
      const db = getDatabase();
      const deals = await db.getDealsByDate(targetDate);
      
      return NextResponse.json({ 
        success: true, 
        message: 'Deals fetched successfully',
        deals,
        date: targetDate
      });
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in POST /api/deals:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
} 