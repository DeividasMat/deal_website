import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseDatabase } from '@/lib/supabase';
import { format } from 'date-fns';

export async function GET() {
  try {
    console.log('🧪 Testing Supabase connection...');
    
    const db = getSupabaseDatabase();
    
    // Test connection
    const connectionTest = await db.testConnection();
    
    if (!connectionTest.success) {
      return NextResponse.json({
        success: false,
        error: 'Supabase connection failed',
        details: connectionTest.message,
        instructions: 'Please check your Supabase configuration and run the setup SQL'
      }, { status: 500 });
    }

    // Get current deals count
    const allDeals = await db.getAllDeals();
    
    return NextResponse.json({
      success: true,
      message: 'Supabase connection successful!',
      connectionTest,
      currentDealsCount: allDeals.length,
      canSaveNews: true
    });

  } catch (error) {
    console.error('❌ Supabase test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      instructions: error instanceof Error && error.message.includes('does not exist') 
        ? 'Please run the database setup SQL in your Supabase dashboard'
        : 'Check your environment variables and Supabase configuration'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing Supabase save functionality...');
    
    const body = await request.json();
    const { testSave } = body;
    
    if (testSave) {
      const db = getSupabaseDatabase();
      
      // Create a test deal
      const testDeal = {
        date: format(new Date(), 'yyyy-MM-dd'),
        title: 'Test Deal - Supabase Connection Verified',
        summary: 'This is a test article to verify that news can be saved directly to Supabase. The connection is working properly.',
        content: 'Full content of the test deal. This confirms that the Supabase integration is functional and ready to save real news articles.',
        source: 'Supabase Test',
        source_url: undefined,
        category: 'Test'
      };
      
      // Save the test deal
      const dealId = await db.saveDeal(testDeal);
      
      // Verify it was saved by retrieving it
      const savedDeals = await db.getDealsByDate(testDeal.date);
      const savedDeal = savedDeals.find(deal => deal.id === dealId);
      
      return NextResponse.json({
        success: true,
        message: 'Test deal saved successfully to Supabase!',
        testDeal: {
          id: dealId,
          title: savedDeal?.title,
          date: savedDeal?.date,
          created_at: savedDeal?.created_at
        },
        readyForNewsCollection: true
      });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Invalid request - missing testSave parameter'
    }, { status: 400 });

  } catch (error) {
    console.error('❌ Supabase save test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Save test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 