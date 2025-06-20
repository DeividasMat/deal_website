import { getSupabaseDatabase } from './supabase';

export interface Deal {
  id?: number;
  date: string;
  title: string;
  summary: string;
  content: string;
  source: string;
  source_url?: string;
  category?: string;
  upvotes?: number;
  created_at?: string;
}

export interface Vote {
  id?: number;
  article_id: number;
  user_ip: string;
  created_at?: string;
}

// Re-export the Supabase database with the same interface
export function getDatabase() {
  return getSupabaseDatabase();
} 