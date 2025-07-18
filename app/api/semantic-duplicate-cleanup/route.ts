import { NextRequest, NextResponse } from 'next/server';
import { semanticDuplicateDetector } from '@/lib/semantic-duplicate-detector';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Starting semantic duplicate detection (DRY RUN)...');
    
    // Always run in dry-run mode for GET requests
    const result = await semanticDuplicateDetector.cleanupSemanticDuplicates(true);
    
    return NextResponse.json({
      success: true,
      message: 'Semantic duplicate analysis completed (DRY RUN)',
      mode: 'dry_run',
      results: {
        duplicates_found: result.found,
        would_delete: result.found,
        would_keep: result.found,
        details: result.details
      },
      note: 'This is a DRY RUN - no articles were deleted. Use POST to perform actual cleanup.'
    });
    
  } catch (error) {
    console.error('❌ Error in semantic duplicate detection:', error);
    return NextResponse.json({
      success: false,
      error: 'Semantic duplicate detection failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { dryRun = true, confirmationToken } = await request.json();
    
    console.log(`🔍 Starting semantic duplicate cleanup (${dryRun ? 'DRY RUN' : 'LIVE'})...`);
    
    // Require confirmation token for live cleanup
    if (!dryRun && confirmationToken !== 'CLEANUP_SEMANTIC_DUPLICATES') {
      return NextResponse.json({
        success: false,
        error: 'Invalid confirmation token',
        message: 'Must provide confirmationToken: "CLEANUP_SEMANTIC_DUPLICATES" for live cleanup'
      }, { status: 400 });
    }
    
    const result = await semanticDuplicateDetector.cleanupSemanticDuplicates(dryRun);
    
    return NextResponse.json({
      success: true,
      message: `Semantic duplicate cleanup completed (${dryRun ? 'DRY RUN' : 'LIVE'})`,
      mode: dryRun ? 'dry_run' : 'live',
      results: {
        duplicates_found: result.found,
        deleted: result.deleted,
        kept: result.kept,
        failed: result.failed,
        details: result.details
      },
      note: dryRun ? 'This was a DRY RUN - no articles were deleted' : 'LIVE cleanup completed - articles were actually deleted'
    });
    
  } catch (error) {
    console.error('❌ Error in semantic duplicate cleanup:', error);
    return NextResponse.json({
      success: false,
      error: 'Semantic duplicate cleanup failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 