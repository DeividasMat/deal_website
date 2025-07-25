import { OpenAIService } from './openai';

export class EnhancedDuplicateDetector {
  private openai: OpenAIService;

  constructor() {
    this.openai = new OpenAIService();
  }

  /**
   * Advanced duplicate detection using multiple techniques
   */
  async findDuplicates(articles: any[]): Promise<{ duplicates: any[], toRemove: number[] }> {
    const duplicates: any[] = [];
    const toRemove: number[] = [];
    const processed = new Set<number>();

    console.log(`🔍 Enhanced duplicate detection on ${articles.length} articles`);

    for (let i = 0; i < articles.length; i++) {
      if (processed.has(i)) continue;

      const article1 = articles[i];
      const similarArticles = [article1];

      for (let j = i + 1; j < articles.length; j++) {
        if (processed.has(j)) continue;

        const article2 = articles[j];
        
        // Check if articles are similar using multiple methods
        const isSimilar = await this.areArticlesSimilar(article1, article2);
        
        if (isSimilar) {
          similarArticles.push(article2);
          processed.add(j);
          toRemove.push(j);
        }
      }

      if (similarArticles.length > 1) {
        // Keep the best article from the group
        const bestArticle = this.selectBestArticle(similarArticles);
        duplicates.push({
          bestArticle,
          duplicates: similarArticles.filter(a => a.id !== bestArticle.id),
          reason: 'Similar content detected'
        });
      }

      processed.add(i);
    }

    return { duplicates, toRemove };
  }

  /**
   * Determine if two articles are similar using multiple techniques
   */
  private async areArticlesSimilar(article1: any, article2: any): Promise<boolean> {
    // 1. Exact title match
    if (this.normalizeTitle(article1.title) === this.normalizeTitle(article2.title)) {
      return true;
    }

    // 2. Title similarity (high threshold)
    const titleSimilarity = this.calculateSimilarity(
      this.normalizeTitle(article1.title),
      this.normalizeTitle(article2.title)
    );
    
    if (titleSimilarity > 0.85) {
      return true;
    }

    // 3. Content similarity for moderately similar titles
    if (titleSimilarity > 0.6) {
      const contentSimilarity = this.calculateSimilarity(
        this.normalizeContent(article1.summary),
        this.normalizeContent(article2.summary)
      );
      
      if (contentSimilarity > 0.8) {
        return true;
      }
    }

    // 4. Key entity extraction for financial news
    const entitiesMatch = this.extractAndCompareEntities(article1, article2);
    if (entitiesMatch) {
      return true;
    }

    // 5. Use AI for semantic similarity (for edge cases)
    if (titleSimilarity > 0.5) {
      const aiSimilar = await this.checkAISimilarity(article1, article2);
      if (aiSimilar) {
        return true;
      }
    }

    return false;
  }

  /**
   * Normalize title for comparison
   */
  private normalizeTitle(title: string): string {
    return title.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\b(inc|ltd|llc|corp|company|fund|capital|management|group|partners|investments?)\b/g, '')
      .replace(/\b(announces?|completes?|closes?|raises?|secures?|launches?|forms?)\b/g, '')
      .replace(/\b(million|billion|[0-9]+m|[0-9]+b|\$[0-9,]+)\b/g, '')
      .trim();
  }

  /**
   * Normalize content for comparison
   */
  private normalizeContent(content: string): string {
    return content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculate similarity between two strings using Jaccard similarity
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.split(' ').filter(w => w.length > 2));
    const words2 = new Set(str2.split(' ').filter(w => w.length > 2));
    
    const intersection = new Set(Array.from(words1).filter(w => words2.has(w)));
    const union = new Set([...Array.from(words1), ...Array.from(words2)]);
    
    return intersection.size / union.size;
  }

  /**
   * Extract and compare key financial entities
   */
  private extractAndCompareEntities(article1: any, article2: any): boolean {
    const entities1 = this.extractFinancialEntities(article1.title + ' ' + article1.summary);
    const entities2 = this.extractFinancialEntities(article2.title + ' ' + article2.summary);
    
    // Check for significant entity overlap
    const commonEntities = entities1.filter(e => entities2.includes(e));
    const totalEntities = Array.from(new Set([...entities1, ...entities2])).length;
    
    return commonEntities.length > 0 && (commonEntities.length / totalEntities) > 0.6;
  }

  /**
   * Extract financial entities from text
   */
  private extractFinancialEntities(text: string): string[] {
    const entities: string[] = [];
    const normalized = text.toLowerCase();
    
    // Extract dollar amounts
    const amounts = normalized.match(/\$[\d,]+(?:\.\d+)?(?:\s?(?:million|billion|m|b))?/g) || [];
    entities.push(...amounts.map(a => a.replace(/\s/g, '')));
    
    // Extract company names (simplified)
    const companies = normalized.match(/\b[A-Z][a-z]+\s+(?:capital|partners|management|fund|investments?|holdings?|group|corporation|llc|inc)\b/gi) || [];
    entities.push(...companies.map(c => c.toLowerCase()));
    
    // Extract fund names
    const funds = normalized.match(/\b[A-Z][a-z]+\s+fund\s+(?:i{1,3}|iv|v|vi{1,3}|[0-9]+)\b/gi) || [];
    entities.push(...funds.map(f => f.toLowerCase()));
    
    return entities;
  }

  /**
   * Use AI to check semantic similarity
   */
  private async checkAISimilarity(article1: any, article2: any): Promise<boolean> {
    try {
      return await this.openai.detectSemanticDuplicate(article1, article2);
    } catch (error) {
      console.error('AI similarity check failed:', error);
      return false;
    }
  }

  /**
   * Select the best article from a group of similar articles
   */
  private selectBestArticle(articles: any[]): any {
    return articles.reduce((best, current) => {
      // Scoring criteria
      const bestScore = this.calculateArticleScore(best);
      const currentScore = this.calculateArticleScore(current);
      
      return currentScore > bestScore ? current : best;
    });
  }

  /**
   * Calculate quality score for an article
   */
  private calculateArticleScore(article: any): number {
    let score = 0;
    
    // Title quality
    score += Math.min(article.title.length / 10, 10); // up to 10 points
    
    // Summary quality
    score += Math.min(article.summary.length / 50, 20); // up to 20 points
    
    // Source quality
    const sourceScore = this.getSourceScore(article.source);
    score += sourceScore;
    
    // URL availability
    if (article.source_url) {
      score += 5;
    }
    
    // Recency
    const daysSinceCreation = (new Date().getTime() - new Date(article.created_at || article.date).getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 10 - daysSinceCreation); // up to 10 points for newer articles
    
    // Upvotes
    score += (article.upvotes || 0) * 2;
    
    return score;
  }

  /**
   * Get source quality score
   */
  private getSourceScore(source: string): number {
    const reputableSources = [
      'Bloomberg', 'Reuters', 'Wall Street Journal', 'Financial Times',
      'Private Debt Investor', 'Pitchbook', 'Preqin', 'Business Wire'
    ];
    
    const goodSources = [
      'PE Hub', 'Buyouts', 'Venture Capital Journal', 'Alternative Investment News'
    ];
    
    if (reputableSources.some(s => source.toLowerCase().includes(s.toLowerCase()))) {
      return 15;
    }
    
    if (goodSources.some(s => source.toLowerCase().includes(s.toLowerCase()))) {
      return 10;
    }
    
    if (source.toLowerCase().includes('financial') || source.toLowerCase().includes('news')) {
      return 5;
    }
    
    return 0;
  }
} 