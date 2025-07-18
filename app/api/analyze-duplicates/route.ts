import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Safety configuration - NEVER allow deletion
const SAFETY_CONFIG = {
  READ_ONLY_MODE: true,
  NEVER_DELETE: true,
  NEVER_MODIFY_DEALS_TABLE: true,
  MAX_ARTICLES_PER_REQUEST: 20, // Limit for API calls
  SIMILARITY_THRESHOLD: 0.7
};

interface DuplicateAnalysis {
  similarity_score: number;
  confidence_level: 'low' | 'medium' | 'high';
  reason: string;
  recommended_action: 'keep_first' | 'keep_second' | 'merge' | 'keep_both';
  analysis_details: any;
}

// Analyze two articles for similarity using OpenAI
async function analyzeArticleSimilarity(article1: any, article2: any): Promise<DuplicateAnalysis | null> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a duplicate detection expert. Analyze two private credit/finance articles and determine if they are duplicates.

ANALYSIS CRITERIA:
1. Content similarity (same deals, companies, amounts)
2. Title similarity (same core information)
3. Source similarity (same news event)
4. Date proximity (same timeframe)

CONFIDENCE LEVELS:
- HIGH: Clearly the same story/deal (90%+ similar)
- MEDIUM: Likely duplicates but with some differences (70-89% similar)
- LOW: Some similarity but probably different stories (50-69% similar)

RECOMMENDED ACTIONS:
- keep_first: Keep article 1, remove article 2
- keep_second: Keep article 2, remove article 1
- merge: Combine information from both
- keep_both: Not duplicates, keep both

Return JSON with:
{
  "is_duplicate": boolean,
  "similarity_score": number (0.0-1.0),
  "confidence_level": "high|medium|low",
  "reason": "detailed explanation",
  "recommended_action": "keep_first|keep_second|merge|keep_both",
  "key_similarities": ["list of similar elements"],
  "key_differences": ["list of different elements"]
}`
        },
        {
          role: 'user',
          content: `Compare these two articles:

ARTICLE 1:
Title: ${article1.title}
Date: ${article1.date}
Source: ${article1.source}
Summary: ${article1.summary}

ARTICLE 2:
Title: ${article2.title}
Date: ${article2.date}
Source: ${article2.source}
Summary: ${article2.summary}

Provide detailed duplicate analysis.`
        }
      ],
      max_tokens: 800,
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const analysis = JSON.parse(response.choices[0].message.content!);
    
    return {
      similarity_score: analysis.similarity_score,
      confidence_level: analysis.confidence_level,
      reason: analysis.reason,
      recommended_action: analysis.recommended_action,
      analysis_details: analysis
    };
    
  } catch (error) {
    console.error(`❌ Error analyzing articles ${article1.id} and ${article2.id}:`, error);
    return null;
  }
}

// Store duplicate analysis result (SAFE - only writes to analysis table)
async function storeDuplicateAnalysis(article1: any, article2: any, analysis: DuplicateAnalysis): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('duplicate_analysis')
      .insert({
        article_1_id: article1.id,
        article_2_id: article2.id,
        similarity_score: analysis.similarity_score,
        similarity_reason: analysis.reason,
        analysis_method: 'openai_content_analysis',
        recommended_action: analysis.recommended_action,
        confidence_level: analysis.confidence_level,
        analysis_details: analysis.analysis_details,
        analyzed_by: 'openai_gpt4'
      });
    
    if (error) {
      // Check if it's a duplicate entry (which is fine)
      if (error.code === '23505') {
        console.log(`⚠️ Analysis already exists for articles ${article1.id} and ${article2.id}`);
        return false;
      }
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Error storing analysis for articles ${article1.id} and ${article2.id}:`, error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔒 Starting safe duplicate analysis (READ-ONLY mode)');
    
    // Safety verification
    if (!SAFETY_CONFIG.READ_ONLY_MODE || !SAFETY_CONFIG.NEVER_DELETE || !SAFETY_CONFIG.NEVER_MODIFY_DEALS_TABLE) {
      throw new Error('❌ SAFETY ERROR: Invalid safety configuration');
    }
    
    const { limit = 20, offset = 0 } = await request.json();
    
    // Read articles from deals table (READ-ONLY)
    console.log(`📖 Reading ${limit} articles from deals table (READ-ONLY)...`);
    
    const { data: articles, error } = await supabase
      .from('deals')
      .select('id, title, summary, content, date, source, upvotes, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      throw new Error(`❌ Error reading articles: ${error.message}`);
    }
    
    if (!articles || articles.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No articles found to analyze'
      });
    }
    
    console.log(`📊 Found ${articles.length} articles to analyze`);
    
    let totalComparisons = 0;
    let duplicatesFound = 0;
    let analysisStored = 0;
    const duplicatesDetails: any[] = [];
    
    // Compare each article with all others
    for (let i = 0; i < articles.length; i++) {
      for (let j = i + 1; j < articles.length; j++) {
        const article1 = articles[i];
        const article2 = articles[j];
        
        totalComparisons++;
        
        // Analyze similarity
        const analysis = await analyzeArticleSimilarity(article1, article2);
        
        if (analysis && analysis.similarity_score >= SAFETY_CONFIG.SIMILARITY_THRESHOLD) {
          duplicatesFound++;
          
          console.log(`🔍 Found potential duplicate (${analysis.similarity_score.toFixed(3)}): "${article1.title.substring(0, 50)}..." vs "${article2.title.substring(0, 50)}..."`);
          
          // Store analysis result (SAFE - only writes to analysis table)
          const stored = await storeDuplicateAnalysis(article1, article2, analysis);
          if (stored) {
            analysisStored++;
          }
          
          duplicatesDetails.push({
            article1: { id: article1.id, title: article1.title },
            article2: { id: article2.id, title: article2.title },
            similarity_score: analysis.similarity_score,
            confidence_level: analysis.confidence_level,
            recommended_action: analysis.recommended_action,
            reason: analysis.reason
          });
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Get database summary
    const { data: summary } = await supabase
      .from('duplicate_analysis_summary')
      .select('*')
      .single();
    
    return NextResponse.json({
      success: true,
      message: 'Duplicate analysis completed successfully',
      results: {
        articles_analyzed: articles.length,
        total_comparisons: totalComparisons,
        duplicates_found: duplicatesFound,
        analysis_stored: analysisStored,
        duplicate_rate: ((duplicatesFound / totalComparisons) * 100).toFixed(2),
        duplicates_details: duplicatesDetails,
        database_summary: summary
      },
      safety_note: 'Original deals table was never modified (READ-ONLY mode)'
    });
    
  } catch (error) {
    console.error('❌ Error during duplicate analysis:', error);
    return NextResponse.json({
      success: false,
      error: 'Duplicate analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get analysis results from database
    const { data: results, error } = await supabase
      .from('duplicate_analysis_with_details')
      .select('*')
      .order('similarity_score', { ascending: false })
      .limit(50);
    
    if (error) {
      throw new Error(`❌ Error reading analysis results: ${error.message}`);
    }
    
    // Get summary statistics
    const { data: summary } = await supabase
      .from('duplicate_analysis_summary')
      .select('*')
      .single();
    
    return NextResponse.json({
      success: true,
      results: results || [],
      summary: summary || null,
      total_pairs: results?.length || 0
    });
    
  } catch (error) {
    console.error('❌ Error retrieving analysis results:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve analysis results',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 