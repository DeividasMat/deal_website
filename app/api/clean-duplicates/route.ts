import { NextResponse } from 'next/server';
import { duplicateCleaner } from '../../../lib/duplicate-cleaner';

export async function POST(request: Request) {
  try {
    console.log('🧹 Starting duplicate cleanup via API...');
    
    const result = await duplicateCleaner.cleanDatabase();
    
    console.log('✅ Duplicate cleanup completed');
    
    return NextResponse.json({
      success: true,
      message: 'Duplicate cleanup completed successfully',
      data: result
    });
  } catch (error) {
    console.error('❌ Error during duplicate cleanup:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to run duplicate cleanup',
    usage: {
      method: 'POST',
      endpoint: '/api/clean-duplicates',
      description: 'Removes duplicate articles from the database'
    }
  });
} 