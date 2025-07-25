import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { getScheduler } from '@/lib/scheduler';
import { OpenAIService } from '@/lib/openai';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { query, refresh = false } = body;
  const db = getDatabase();
  const openai = new OpenAIService();
  
  if (!query) return NextResponse.json({ error: 'Query required' }, { status: 400 });
  
  // Search DB first
  const existing = await db.searchDealsByTitle(query); // Assume this method exists or add it
  if (existing.length > 0 && !refresh) {
    return NextResponse.json({ deals: existing });
  }
  
  // Regenerate
  const scheduler = getScheduler();
  const search1 = await scheduler.getPerplexityService().searchPrivateCreditDeals(new Date().toISOString().split('T')[0], query);
  const search2 = await scheduler.getPerplexityService().searchPrivateCreditDeals(new Date().toISOString().split('T')[0], `${query} additional details`); // Second query for more info
  const report = await openai.generateCombinedReport([search1, search2]);
  
  // Save/update DB
  const updatedDeal = {
    date: new Date().toISOString().split('T')[0],
    title: query,
    summary: report,
    content: `${search1}\n\n${search2}`,
    source: 'Perplexity + OpenAI',
    source_url: undefined,
    category: 'Fund Report'
  };
  await db.saveDeal(updatedDeal);
  
  return NextResponse.json({ updatedDeal });
} 