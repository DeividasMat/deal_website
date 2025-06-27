import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export async function GET() {
  try {
    const db = getDatabase();
    
    // Get all deals
    const allDeals = await db.getAllDeals();
    
    // Group by date
    const dealsByDate: { [key: string]: number } = {};
    const dealsBySource: { [key: string]: number } = {};
    const dealsByCategory: { [key: string]: number } = {};
    
    allDeals.forEach(deal => {
      dealsByDate[deal.date] = (dealsByDate[deal.date] || 0) + 1;
      dealsBySource[deal.source] = (dealsBySource[deal.source] || 0) + 1;
      dealsByCategory[deal.category || 'Unknown'] = (dealsByCategory[deal.category || 'Unknown'] || 0) + 1;
    });
    
    return NextResponse.json({
      success: true,
      database: {
        tableName: 'deals',
        totalRecords: allDeals.length,
        sampleRecords: allDeals.slice(0, 5).map(deal => ({
          id: deal.id,
          date: deal.date,
          title: deal.title.substring(0, 60) + '...',
          source: deal.source,
          category: deal.category,
          created_at: deal.created_at
        })),
        breakdown: {
          totalCount: allDeals.length,
          byDate: Object.entries(dealsByDate)
            .sort(([a], [b]) => b.localeCompare(a))
            .slice(0, 10), // Most recent 10 dates
          bySource: Object.entries(dealsBySource)
            .sort(([, a], [, b]) => b - a), // Sort by count
          byCategory: Object.entries(dealsByCategory)
            .sort(([, a], [, b]) => b - a)
        }
      },
      environment: {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...',
        hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      tableName: 'deals (attempted)'
    }, { status: 500 });
  }
} 