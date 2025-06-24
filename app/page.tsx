'use client';

import { useState, useEffect } from 'react';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';

interface Deal {
  id: number;
  date: string;
  title: string;
  summary: string;
  content: string;
  source: string;
  source_url?: string;
  category?: string;
  upvotes?: number;
  created_at: string;
}

// Enhanced categorization logic
const categorizeArticle = (deal: Deal): { category: string; region: string; type: string } => {
  const title = deal.title.toLowerCase();
  const summary = deal.summary.toLowerCase();
  const content = deal.content.toLowerCase();
  
  // Region detection
  let region = 'Global';
  if (title.includes('europe') || summary.includes('europe') || content.includes('europe') || 
      title.includes('eltif') || summary.includes('eltif') || content.includes('eltif') ||
      title.includes('€') || summary.includes('€') || content.includes('€')) {
    region = 'Europe';
  } else if (title.includes('us ') || title.includes('usa') || title.includes('america') || 
             summary.includes('us ') || summary.includes('usa') || summary.includes('america') ||
             title.includes('$') || summary.includes('$') || content.includes('$')) {
    region = 'US';
  } else if (title.includes('uk') || title.includes('britain') || title.includes('£') ||
             summary.includes('uk') || summary.includes('britain') || summary.includes('£')) {
    region = 'UK';
  } else if (title.includes('asia') || title.includes('japan') || title.includes('china') ||
             summary.includes('asia') || summary.includes('japan') || summary.includes('china')) {
    region = 'Asia';
  }
  
  // Type detection
  let type = 'Market News';
  if (title.includes('fund') && (title.includes('raise') || title.includes('launch') || title.includes('close'))) {
    type = 'Fund Raising';
  } else if (title.includes('private equity') || title.includes('pe ') || summary.includes('private equity')) {
    type = 'Private Equity';
  } else if (title.includes('credit facility') || title.includes('loan') || title.includes('financing') ||
             title.includes('warehouse') || title.includes('revolving') || title.includes('term loan')) {
    type = 'Credit Facility';
  } else if (title.includes('acquisition') || title.includes('merger') || title.includes('buyout')) {
    type = 'M&A';
  } else if (title.includes('ipo') || title.includes('public offering') || title.includes('listing')) {
    type = 'Public Markets';
  } else if (title.includes('distressed') || title.includes('restructuring') || title.includes('bankruptcy')) {
    type = 'Distressed';
  } else if (title.includes('real estate') || title.includes('property') || title.includes('reit')) {
    type = 'Real Estate';
  } else if (title.includes('infrastructure') || title.includes('energy') || title.includes('utilities')) {
    type = 'Infrastructure';
  }
  
  // Category based on existing category or type
  let category = deal.category || type;
  
  return { category, region, type };
};

// Bloomberg-style color schemes for different categories
const getCategoryColor = (type: string): string => {
  const colors: { [key: string]: string } = {
    'Fund Raising': 'badge-fund-raising',
    'Private Equity': 'badge-private-equity',
    'Credit Facility': 'badge-credit-facility',
    'M&A': 'badge-ma',
    'Public Markets': 'badge-private-equity',
    'Distressed': 'badge-distressed',
    'Real Estate': 'badge-ma',
    'Infrastructure': 'badge-credit-facility',
    'Market News': 'badge-private-equity',
    'Deal Activity': 'badge-credit-facility',
  };
  return colors[type] || 'badge-private-equity';
};

const getRegionFlag = (region: string): string => {
  const flags: { [key: string]: string } = {
    'US': '🇺🇸',
    'Europe': '🇪🇺',
    'UK': '🇬🇧',
    'Asia': '🌏',
    'Global': '🌍',
  };
  return flags[region] || '🌍';
};

export default function Home() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDateRange, setSelectedDateRange] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [upvoting, setUpvoting] = useState<number | null>(null);
  const [apiStatus, setApiStatus] = useState<{perplexity: string, openai: string, supabase: string} | null>(null);

  // Load all deals and check API status on component mount
  useEffect(() => {
    loadAllDeals();
    loadAvailableDates();
    checkApiStatus();
  }, []);

  // Filter deals when filters change
  useEffect(() => {
    filterDeals();
  }, [deals, selectedCategory, selectedRegion]);

  const checkApiStatus = async () => {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      setApiStatus(data.services);
    } catch (error) {
      console.error('Error checking API status:', error);
    }
  };

  const loadAvailableDates = async () => {
    try {
      const response = await fetch('/api/deals');
      const data = await response.json();
      setAvailableDates(data.dates || []);
    } catch (error) {
      console.error('Error loading dates:', error);
    }
  };

  const loadAllDeals = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/deals/all');
      const data = await response.json();
      
      // Remove duplicates based on title similarity
      const uniqueDeals = removeDuplicates(data.deals || []);
      setDeals(uniqueDeals);
    } catch (error) {
      console.error('Error loading all deals:', error);
      setDeals([]);
    } finally {
      setLoading(false);
    }
  };

  // Enhanced duplicate removal
  const removeDuplicates = (deals: Deal[]): Deal[] => {
    const seen = new Map<string, Deal>();
    
    deals.forEach(deal => {
      const normalizedTitle = deal.title.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Keep the one with more upvotes or more recent
      if (!seen.has(normalizedTitle)) {
        seen.set(normalizedTitle, deal);
      } else {
        const existing = seen.get(normalizedTitle)!;
        if ((deal.upvotes || 0) > (existing.upvotes || 0) || 
            new Date(deal.created_at) > new Date(existing.created_at)) {
          seen.set(normalizedTitle, deal);
        }
      }
    });
    
    return Array.from(seen.values());
  };

  const filterDeals = () => {
    let filtered = [...deals];
    
    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(deal => {
        const { type } = categorizeArticle(deal);
        return type === selectedCategory;
      });
    }
    
    // Region filter
    if (selectedRegion !== 'all') {
      filtered = filtered.filter(deal => {
        const { region } = categorizeArticle(deal);
        return region === selectedRegion;
      });
    }
    
    setFilteredDeals(filtered);
  };

  const loadDealsByDateRange = async (dateRange: string) => {
    if (dateRange === 'all') {
      loadAllDeals();
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`/api/deals?dateRange=${dateRange}`);
      const data = await response.json();
      const uniqueDeals = removeDuplicates(data.deals || []);
      setDeals(uniqueDeals);
    } catch (error) {
      console.error('Error loading deals:', error);
      setDeals([]);
    } finally {
      setLoading(false);
    }
  };



  const handleUpvote = async (articleId: number) => {
    if (upvoting === articleId) return;
    
    setUpvoting(articleId);
    try {
      const response = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upvote', articleId: articleId }),
      });

      const data = await response.json();
      
      if (data.success) {
        setDeals(prevDeals => 
          prevDeals.map(deal => 
            deal.id === articleId 
              ? { ...deal, upvotes: (deal.upvotes || 0) + 1 }
              : deal
          )
        );
      } else {
        alert(data.message || 'Failed to vote');
      }
    } catch (error) {
      console.error('Error upvoting:', error);
    } finally {
      setUpvoting(null);
    }
  };

  const handleDateRangeChange = (dateRange: string) => {
    setSelectedDateRange(dateRange);
    loadDealsByDateRange(dateRange);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isToday(date)) return 'Today';
      if (isYesterday(date)) return 'Yesterday';
      if (isThisWeek(date)) return format(date, 'EEEE');
      return format(date, 'MMM d, yyyy');
    } catch {
      return dateString;
    }
  };

  // Get unique categories and regions from current deals
  const categories = Array.from(new Set(deals.map(deal => categorizeArticle(deal).type))).sort();
  const regions = Array.from(new Set(deals.map(deal => categorizeArticle(deal).region))).sort();

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)' }}>
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* API Configuration Warning */}
        {(apiStatus?.perplexity === 'missing' || apiStatus?.openai === 'missing' || apiStatus?.supabase === 'missing') && (
          <div className="status-warning rounded-xl p-6 shadow-bloomberg">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold mb-2 text-caption">
                  Configuration Required
                </h3>
                <div className="text-sm space-y-2 text-body">
                  {apiStatus?.supabase === 'missing' && (
                    <p>🗄️ <strong>Missing Supabase configuration</strong> - Configure your cloud database</p>
                  )}
                  {apiStatus?.perplexity === 'missing' && (
                    <p>🔑 <strong>Missing Perplexity API key</strong> - Required for news intelligence</p>
                  )}
                  {apiStatus?.openai === 'missing' && (
                    <p>🔑 <strong>Missing OpenAI API key</strong> - Required for content analysis</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center pb-8">
          <div className="divider mb-8"></div>
          <h1 className="text-headline text-6xl mb-4 tracking-tight" style={{ color: 'var(--dark-navy)' }}>
            Private Credit Intelligence
          </h1>
          <p className="text-subheadline text-xl max-w-2xl mx-auto" style={{ color: 'var(--slate-600)' }}>
            Real-time market intelligence, transaction analysis, and fund activity across global private credit markets
          </p>
          <div className="divider mt-8"></div>
        </div>

        {/* Enhanced Filters */}
        <div className="card-elevated rounded-xl p-8">
          <div className="mb-6">
            <h2 className="text-headline text-lg mb-2" style={{ color: 'var(--dark-navy)' }}>Market Intelligence Filters</h2>
            <p className="text-caption" style={{ color: 'var(--slate-600)' }}>Refine your view of private credit market activity</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Time Period */}
            <div className="space-y-3">
              <label className="block text-caption" style={{ color: 'var(--slate-700)' }}>
                📅 Time Period
              </label>
              <select
                value={selectedDateRange}
                onChange={(e) => handleDateRangeChange(e.target.value)}
                className="form-select w-full px-4 py-3 rounded-lg"
              >
                <option value="all">All Periods</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">This Week</option>
              </select>
              <div className="text-xs" style={{ color: 'var(--slate-500)' }}>
                Filter by publication date
              </div>
            </div>

            {/* Deal Type Filter */}
            <div className="space-y-3">
              <label className="block text-caption" style={{ color: 'var(--slate-700)' }}>
                🏷️ Transaction Type
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="form-select w-full px-4 py-3 rounded-lg"
              >
                <option value="all">All Transaction Types</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <div className="text-xs" style={{ color: 'var(--slate-500)' }}>
                {categories.length} types available
              </div>
            </div>

            {/* Geographic Region */}
            <div className="space-y-3">
              <label className="block text-caption" style={{ color: 'var(--slate-700)' }}>
                🌍 Geographic Focus
              </label>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="form-select w-full px-4 py-3 rounded-lg"
              >
                <option value="all">Global Coverage</option>
                {regions.map(region => (
                  <option key={region} value={region}>{getRegionFlag(region)} {region}</option>
                ))}
              </select>
              <div className="text-xs" style={{ color: 'var(--slate-500)' }}>
                {regions.length} regions tracked
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Bar */}
        {!loading && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card-elevated rounded-lg p-6 text-center">
              <div className="text-3xl font-bold mb-2 text-headline" style={{ color: 'var(--dark-navy)' }}>{filteredDeals.length}</div>
              <div className="text-caption" style={{ color: 'var(--slate-600)' }}>Total Articles</div>
            </div>
            <div className="card-elevated rounded-lg p-6 text-center">
              <div className="text-3xl font-bold mb-2 text-headline" style={{ color: 'var(--success-green)' }}>{categories.length}</div>
              <div className="text-caption" style={{ color: 'var(--slate-600)' }}>Deal Types</div>
            </div>
            <div className="card-elevated rounded-lg p-6 text-center">
              <div className="text-3xl font-bold mb-2 text-headline" style={{ color: 'var(--primary-blue)' }}>{regions.length}</div>
              <div className="text-caption" style={{ color: 'var(--slate-600)' }}>Regions</div>
            </div>
            <div className="card-elevated rounded-lg p-6 text-center">
              <div className="text-3xl font-bold mb-2 text-headline" style={{ color: 'var(--accent-orange)' }}>
                {filteredDeals.reduce((sum, deal) => sum + (deal.upvotes || 0), 0)}
              </div>
              <div className="text-caption" style={{ color: 'var(--slate-600)' }}>Total Upvotes</div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-20">
            <div className="spinner w-16 h-16 mx-auto mb-6"></div>
            <p className="text-subheadline text-xl mb-2" style={{ color: 'var(--slate-700)' }}>
              Loading Intelligence...
            </p>
            <p className="text-caption" style={{ color: 'var(--slate-600)' }}>
              Organizing market data
            </p>
          </div>
        )}

        {/* Enhanced News Display */}
        {!loading && (
          <div className="space-y-6">
            {filteredDeals.length === 0 ? (
              <div className="text-center py-20 card-elevated rounded-xl">
                <div className="text-8xl mb-8" style={{ color: 'var(--slate-300)' }}>📊</div>
                <h3 className="text-headline text-2xl mb-4" style={{ color: 'var(--slate-800)' }}>No Articles Found</h3>
                <p className="text-body mb-8 max-w-md mx-auto" style={{ color: 'var(--slate-600)' }}>
                  {selectedCategory !== 'all' || selectedRegion !== 'all' 
                    ? 'Try adjusting your filters to see more content'
                    : 'No articles match your current criteria'
                  }
                </p>
                <p className="text-caption" style={{ color: 'var(--slate-500)' }}>
                  AI-powered analysis from global financial sources
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredDeals
                  .sort((a, b) => {
                    // Sort by upvotes first, then by date
                    if ((b.upvotes || 0) !== (a.upvotes || 0)) {
                      return (b.upvotes || 0) - (a.upvotes || 0);
                    }
                    return new Date(b.date).getTime() - new Date(a.date).getTime();
                  })
                  .map((deal) => {
                    const { category, region, type } = categorizeArticle(deal);
                    const categoryColor = getCategoryColor(type);
                    const regionFlag = getRegionFlag(region);
                    
                    return (
                      <article key={deal.id} className="card-elevated rounded-xl group">
                        <div className="p-8">
                          {/* Header with badges */}
                          <div className="flex flex-wrap items-start justify-between mb-6 gap-4">
                            <div className="flex-grow">
                              <div className="flex flex-wrap items-center gap-3 mb-4">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${categoryColor}`}>
                                  {type}
                                </span>
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium badge-private-equity">
                                  {regionFlag} {region}
                                </span>
                                <span className="text-caption" style={{ color: 'var(--slate-500)' }}>
                                  {formatDate(deal.date)}
                                </span>
                              </div>
                              <h3 className="text-headline text-xl mb-3 leading-tight group-hover:opacity-80 transition-opacity" style={{ color: 'var(--dark-navy)' }}>
                                {deal.title}
                              </h3>
                            </div>
                            
                            {/* Upvote button */}
                            <div className="flex flex-col items-center">
                              <button
                                onClick={() => handleUpvote(deal.id)}
                                disabled={upvoting === deal.id}
                                className="flex flex-col items-center p-3 rounded-xl transition-all duration-200 group border border-transparent hover:bg-surface-gradient hover:shadow-bloomberg disabled:opacity-50"
                                title="Upvote this article"
                              >
                                <svg className="w-6 h-6 transition-colors group-hover:opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--slate-400)' }}>
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                                <span className="text-sm font-semibold mt-1" style={{ color: 'var(--slate-600)' }}>
                                  {deal.upvotes || 0}
                                </span>
                              </button>
                            </div>
                          </div>
                          
                          {/* Content */}
                          <div className="text-body leading-relaxed mb-6" style={{ color: 'var(--slate-700)' }}>
                            {deal.summary}
                          </div>
                          
                          {/* Footer */}
                                                      <div className="pt-6">
                              <div className="divider mb-4"></div>
                              <div className="flex items-center justify-between text-caption">
                                <div className="flex items-center space-x-6">
                                  {deal.source_url ? (
                                    <a 
                                      href={deal.source_url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="font-medium transition-opacity hover:opacity-80 inline-flex items-center"
                                      style={{ color: 'var(--primary-blue)' }}
                                    >
                                      📰 Read Original Article
                                      <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                    </a>
                                  ) : (
                                    <span className="font-medium" style={{ color: 'var(--slate-600)' }}>
                                      📰 AI-Curated Intelligence
                                    </span>
                                  )}
                                  <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: 'var(--slate-100)', color: 'var(--slate-600)' }}>
                                    AI Analyzed
                                  </span>
                                </div>
                                <span className="font-light" style={{ color: 'var(--slate-500)' }}>
                                  {format(new Date(deal.created_at), 'MMM d, h:mm a')}
                                </span>
                              </div>
                            </div>
                        </div>
                      </article>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 