import { NextResponse } from 'next/server';
import { advancedDuplicateCleaner } from '../../../lib/advanced-duplicate-cleaner';

export async function POST(request: Request) {
  try {
    console.log('🚀 Starting advanced duplicate cleanup via API...');
    
    const result = await advancedDuplicateCleaner.cleanDatabase();
    
    console.log('✅ Advanced duplicate cleanup completed');
    
    return NextResponse.json({
      success: true,
      message: 'Advanced duplicate cleanup completed successfully',
      data: result
    });
  } catch (error) {
    console.error('❌ Error during advanced duplicate cleanup:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to run advanced duplicate cleanup with OpenAI',
    usage: {
      method: 'POST',
      endpoint: '/api/advanced-clean-duplicates',
      description: 'Removes duplicate articles from the database using advanced OpenAI analysis'
    }
  });
} 