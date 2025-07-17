const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testSupabase() {
  console.log('🧪 Testing Supabase connection...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Test 1: Check if tables exist
    console.log('📋 Testing table access...');
    const { data: deals, error: dealsError } = await supabase
      .from('deals')
      .select('count', { count: 'exact', head: true });
    
    if (dealsError) {
      console.error('❌ Deals table error:', dealsError.message);
      return;
    }
    
    console.log('✅ Deals table accessible, count:', deals?.[0]?.count || 0);
    
    // Test 2: Try to insert a test record
    console.log('📝 Testing insert operation...');
    const { data: insertData, error: insertError } = await supabase
      .from('deals')
      .insert([{
        date: '2025-06-20',
        title: 'Test Article',
        summary: 'This is a test article to verify Supabase is working properly.',
        content: 'Test content',
        source: 'Test',
        category: 'Test'
      }])
      .select('id')
      .single();
    
    if (insertError) {
      console.error('❌ Insert error:', insertError.message);
      return;
    }
    
    console.log('✅ Insert successful, ID:', insertData.id);
    
    // Test 3: Read the inserted record
    console.log('📖 Testing select operation...');
    const { data: selectData, error: selectError } = await supabase
      .from('deals')
      .select('*')
      .eq('id', insertData.id)
      .single();
    
    if (selectError) {
      console.error('❌ Select error:', selectError.message);
      return;
    }
    
    console.log('✅ Select successful:', selectData.title);
    
    // Test 4: Clean up test record
    console.log('🧹 Cleaning up test record...');
    const { error: deleteError } = await supabase
      .from('deals')
      .delete()
      .eq('id', insertData.id);
    
    if (deleteError) {
      console.error('❌ Delete error:', deleteError.message);
      return;
    }
    
    console.log('✅ Cleanup successful');
    console.log('🎉 All Supabase tests passed!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

testSupabase().catch(console.error); 