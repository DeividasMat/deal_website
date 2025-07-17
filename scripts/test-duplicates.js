require('dotenv').config();

async function testDuplicateRemoval() {
  try {
    console.log('🧹 Testing duplicate removal...');
    
    // Import the scheduler (compiled version)
    const { getScheduler } = await import('../lib/scheduler.js');
    const scheduler = getScheduler();
    
    // Run duplicate cleanup
    const removedCount = await scheduler.runDuplicateCleanup();
    console.log(`✅ Removed ${removedCount} duplicate articles`);
    
    // Get current article count
    const { getDatabase } = await import('../lib/database.js');
    const db = getDatabase();
    const allDeals = await db.getAllDeals();
    console.log(`📊 Total articles remaining: ${allDeals.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testDuplicateRemoval(); 