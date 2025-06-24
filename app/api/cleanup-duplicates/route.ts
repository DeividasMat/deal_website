import { NextResponse } from 'next/server';
import { getSupabaseDatabase } from '@/lib/supabase';

export async function POST() {
  try {
    console.log('🧹 Starting database cleanup for duplicate articles...');
    
    const db = getSupabaseDatabase();
    
    // Get all deals
    const allDeals = await db.getAllDeals();
    console.log(`📊 Found ${allDeals.length} total articles in database`);
    
    // Group deals by normalized title
    const titleGroups = new Map<string, typeof allDeals>();
    
    allDeals.forEach(deal => {
      const normalizedTitle = deal.title.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (!titleGroups.has(normalizedTitle)) {
        titleGroups.set(normalizedTitle, []);
      }
      titleGroups.get(normalizedTitle)!.push(deal);
    });
    
    let duplicatesRemoved = 0;
    let dealIdsToDelete: number[] = [];
    
    // Process each group of similar titles
    for (const [normalizedTitle, deals] of Array.from(titleGroups.entries())) {
      if (deals.length > 1) {
        console.log(`🔍 Found ${deals.length} duplicates for: "${normalizedTitle.substring(0, 50)}..."`);
        
        // Sort by upvotes (desc) then by created_at (desc) to keep the best one
        deals.sort((a, b) => {
          if ((b.upvotes || 0) !== (a.upvotes || 0)) {
            return (b.upvotes || 0) - (a.upvotes || 0);
          }
          return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
        });
        
        // Keep the first one (best), mark others for deletion
        const toDelete = deals.slice(1);
        dealIdsToDelete.push(...toDelete.map(deal => deal.id!));
        duplicatesRemoved += toDelete.length;
        
        console.log(`  ✅ Keeping article ID ${deals[0].id} (${deals[0].upvotes || 0} upvotes)`);
        console.log(`  🗑️ Removing ${toDelete.length} duplicates: ${toDelete.map(d => d.id).join(', ')}`);
      }
    }
    
    if (dealIdsToDelete.length === 0) {
      console.log('✨ No duplicates found! Database is clean.');
      return NextResponse.json({
        success: true,
        message: 'No duplicates found',
        duplicatesRemoved: 0,
        totalArticles: allDeals.length
      });
    }
    
    // Delete duplicates from database
    console.log(`🗑️ Deleting ${dealIdsToDelete.length} duplicate articles...`);
    
    // Delete in batches to avoid overwhelming the database
    const batchSize = 50;
    for (let i = 0; i < dealIdsToDelete.length; i += batchSize) {
      const batch = dealIdsToDelete.slice(i, i + batchSize);
      await db.deleteDealsByIds(batch);
      console.log(`  ✅ Deleted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(dealIdsToDelete.length/batchSize)}`);
    }
    
    console.log(`✅ Database cleanup completed successfully!`);
    console.log(`📊 Summary:`);
    console.log(`  - Original articles: ${allDeals.length}`);
    console.log(`  - Duplicates removed: ${duplicatesRemoved}`);
    console.log(`  - Remaining articles: ${allDeals.length - duplicatesRemoved}`);
    
    return NextResponse.json({
      success: true,
      message: 'Database cleanup completed successfully',
      originalCount: allDeals.length,
      duplicatesRemoved: duplicatesRemoved,
      remainingCount: allDeals.length - duplicatesRemoved,
      uniqueTitles: titleGroups.size
    });
    
  } catch (error) {
    console.error('❌ Error during database cleanup:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Database cleanup failed'
    }, { status: 500 });
  }
} 