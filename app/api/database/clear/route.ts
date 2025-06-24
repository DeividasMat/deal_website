import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseDatabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Clearing entire database...');
    
    const body = await request.json();
    const { confirm } = body;
    
    if (confirm !== 'DELETE_ALL') {
      return NextResponse.json({
        success: false,
        error: 'Confirmation required',
        message: 'Send { "confirm": "DELETE_ALL" } to confirm database clearing'
      }, { status: 400 });
    }
    
    const db = getSupabaseDatabase();
    
    // Get all deals and delete them
    const allDeals = await db.getAllDeals();
    const totalRecords = allDeals.length;
    
    console.log(`📊 Found ${totalRecords} records to delete`);
    
    if (totalRecords === 0) {
      return NextResponse.json({
        success: true,
        message: 'Database is already empty',
        deletedRecords: 0
      });
    }
    
    // Delete all records
    let deletedCount = 0;
    for (const deal of allDeals) {
      await db.deleteDeal(deal.id!);
      deletedCount++;
      if (deletedCount % 10 === 0) {
        console.log(`🗑️ Deleted ${deletedCount}/${totalRecords} records...`);
      }
    }
    
    console.log(`✅ Database cleared: ${deletedCount} records deleted`);
    
    return NextResponse.json({
      success: true,
      message: 'Database cleared successfully',
      deletedRecords: deletedCount,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Database clear error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to clear database',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const db = getSupabaseDatabase();
    const allDeals = await db.getAllDeals();
    
    return NextResponse.json({
      message: 'Database Clear API',
      currentRecords: allDeals.length,
      usage: 'POST with { "confirm": "DELETE_ALL" } to clear entire database',
      warning: 'This action cannot be undone!'
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to check database status',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 