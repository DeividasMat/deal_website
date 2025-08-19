import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering to prevent caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    console.log('🧠 Smart Duplicate Cleanup: Starting contextual duplicate detection...');
    console.log('🕐 Cleanup triggered at:', new Date().toISOString());
    
    const isVercel = !!process.env.VERCEL;
    console.log('Environment check:', { isVercel });
    
    if (isVercel) {
      console.log('✅ Vercel cron - using built-in authentication');
    } else {
      console.log('⚠️ Manual trigger');
    }
    
    // Call the smart duplicate detection API
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : 'https://deal-website-8qyb2ppej-deividasmats-projects.vercel.app';
    
    console.log('🔗 Calling smart duplicate detection API...');
    
    const response = await fetch(`${baseUrl}/api/smart-duplicate-detection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        daysBack: 3,  // Analyze last 3 days
        batchSize: 8  // Smaller batches for cron
      })
    });
    
    if (!response.ok) {
      throw new Error(`Smart duplicate detection failed: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('✅ Smart duplicate cleanup completed:', result);
    
    return NextResponse.json({
      success: true,
      message: 'Smart duplicate cleanup completed',
      ...result,
      timestamp: new Date().toISOString(),
      trigger: 'cron-smart-cleanup'
    });
    
  } catch (error) {
    console.error('❌ Smart duplicate cleanup error:', error);
    return NextResponse.json({
      error: 'Smart duplicate cleanup failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 