import { NextRequest, NextResponse } from 'next/server';
import { getScheduler } from '@/lib/scheduler';

export async function POST(request: NextRequest) {
  try {
    const { preview = false } = await request.json().catch(() => ({}));
    
    console.log('🔍 Testing enhanced duplicate detection system...');
    
    const scheduler = getScheduler();
    
    if (preview) {
      console.log('📋 Preview mode - will show what would be removed');
      
      // Run enhanced duplicate detection to show what would be removed
      const duplicatesRemoved = await scheduler.runEnhancedDuplicateCleanup();
      
      return NextResponse.json({
        message: 'Enhanced duplicate detection test completed',
        duplicatesRemoved,
        preview: true
      });
    } else {
      console.log('🧹 Running enhanced duplicate cleanup...');
      
      // Run the actual cleanup
      const duplicatesRemoved = await scheduler.runEnhancedDuplicateCleanup();
      
      return NextResponse.json({
        message: 'Enhanced duplicate detection completed',
        duplicatesRemoved,
        preview: false
      });
    }
    
  } catch (error) {
    console.error('Error in enhanced duplicate detection:', error);
    return NextResponse.json({ 
      error: 'Failed to run enhanced duplicate detection',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 