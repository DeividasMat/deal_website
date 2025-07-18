-- Duplicate Analysis Table Schema
-- This table stores duplicate identification results without modifying the original deals table

CREATE TABLE IF NOT EXISTS duplicate_analysis (
  id SERIAL PRIMARY KEY,
  article_1_id INTEGER NOT NULL,
  article_2_id INTEGER NOT NULL,
  similarity_score DECIMAL(5,4) NOT NULL, -- 0.0000 to 1.0000
  similarity_reason TEXT NOT NULL,
  analysis_method VARCHAR(50) NOT NULL DEFAULT 'openai_content_analysis',
  recommended_action VARCHAR(20) NOT NULL DEFAULT 'keep_both', -- 'keep_both', 'keep_first', 'keep_second', 'merge'
  confidence_level VARCHAR(10) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high'
  analysis_details JSONB, -- Store detailed analysis from OpenAI
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  analyzed_by VARCHAR(50) DEFAULT 'openai_gpt4',
  
  -- Constraints
  CONSTRAINT duplicate_analysis_similarity_score_check CHECK (similarity_score >= 0.0 AND similarity_score <= 1.0),
  CONSTRAINT duplicate_analysis_different_articles CHECK (article_1_id != article_2_id),
  CONSTRAINT duplicate_analysis_recommended_action_check CHECK (recommended_action IN ('keep_both', 'keep_first', 'keep_second', 'merge')),
  CONSTRAINT duplicate_analysis_confidence_check CHECK (confidence_level IN ('low', 'medium', 'high')),
  
  -- Foreign key references to deals table
  CONSTRAINT fk_article_1 FOREIGN KEY (article_1_id) REFERENCES deals(id) ON DELETE CASCADE,
  CONSTRAINT fk_article_2 FOREIGN KEY (article_2_id) REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Unique constraint to prevent duplicate analysis entries
  CONSTRAINT unique_article_pair UNIQUE (LEAST(article_1_id, article_2_id), GREATEST(article_1_id, article_2_id))
);

-- Create indexes for better performance
CREATE INDEX idx_duplicate_analysis_article_1 ON duplicate_analysis(article_1_id);
CREATE INDEX idx_duplicate_analysis_article_2 ON duplicate_analysis(article_2_id);
CREATE INDEX idx_duplicate_analysis_similarity_score ON duplicate_analysis(similarity_score DESC);
CREATE INDEX idx_duplicate_analysis_confidence ON duplicate_analysis(confidence_level);
CREATE INDEX idx_duplicate_analysis_created_at ON duplicate_analysis(created_at DESC);

-- Create a view to easily see duplicate pairs with article details
CREATE OR REPLACE VIEW duplicate_analysis_with_details AS
SELECT 
  da.id,
  da.similarity_score,
  da.similarity_reason,
  da.recommended_action,
  da.confidence_level,
  da.created_at,
  
  -- Article 1 details
  d1.id AS article_1_id,
  d1.title AS article_1_title,
  d1.date AS article_1_date,
  d1.source AS article_1_source,
  d1.upvotes AS article_1_upvotes,
  d1.created_at AS article_1_created_at,
  
  -- Article 2 details
  d2.id AS article_2_id,
  d2.title AS article_2_title,
  d2.date AS article_2_date,
  d2.source AS article_2_source,
  d2.upvotes AS article_2_upvotes,
  d2.created_at AS article_2_created_at,
  
  -- Analysis details
  da.analysis_details
FROM duplicate_analysis da
JOIN deals d1 ON da.article_1_id = d1.id
JOIN deals d2 ON da.article_2_id = d2.id
ORDER BY da.similarity_score DESC, da.created_at DESC;

-- Create a summary view for quick statistics
CREATE OR REPLACE VIEW duplicate_analysis_summary AS
SELECT 
  COUNT(*) as total_duplicate_pairs,
  COUNT(CASE WHEN confidence_level = 'high' THEN 1 END) as high_confidence_duplicates,
  COUNT(CASE WHEN confidence_level = 'medium' THEN 1 END) as medium_confidence_duplicates,
  COUNT(CASE WHEN confidence_level = 'low' THEN 1 END) as low_confidence_duplicates,
  AVG(similarity_score) as average_similarity_score,
  MAX(similarity_score) as max_similarity_score,
  COUNT(CASE WHEN recommended_action = 'keep_first' THEN 1 END) as recommend_keep_first,
  COUNT(CASE WHEN recommended_action = 'keep_second' THEN 1 END) as recommend_keep_second,
  COUNT(CASE WHEN recommended_action = 'merge' THEN 1 END) as recommend_merge,
  COUNT(CASE WHEN recommended_action = 'keep_both' THEN 1 END) as recommend_keep_both
FROM duplicate_analysis;

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE ON duplicate_analysis TO authenticated;
-- GRANT SELECT ON duplicate_analysis_with_details TO authenticated;
-- GRANT SELECT ON duplicate_analysis_summary TO authenticated; 