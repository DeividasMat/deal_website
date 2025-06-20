'use client';

import { useState, useEffect } from 'react';
import { format, subDays, isToday, isYesterday, isThisWeek } from 'date-fns';

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

// Color schemes for different categories
const getCategoryColor = (type: string): string => {
  const colors: { [key: string]: string } = {
    'Fund Raising': 'bg-emerald-50 border-emerald-200 text-emerald-800',
    'Private Equity': 'bg-blue-50 border-blue-200 text-blue-800',
    'Credit Facility': 'bg-purple-50 border-purple-200 text-purple-800',
    'M&A': 'bg-orange-50 border-orange-200 text-orange-800',
    'Public Markets': 'bg-indigo-50 border-indigo-200 text-indigo-800',
    'Distressed': 'bg-red-50 border-red-200 text-red-800',
    'Real Estate': 'bg-yellow-50 border-yellow-200 text-yellow-800',
    'Infrastructure': 'bg-teal-50 border-teal-200 text-teal-800',
    'Market News': 'bg-slate-50 border-slate-200 text-slate-800',
  };
  return colors[type] || colors['Market News'];
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
  const [fetching, setFetching] = useState(false);
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

  const fetchNewDeals = async () => {
    setFetching(true);
    try {
      let requestBody;
      
      if (selectedDateRange === 'week') {
        requestBody = { action: 'fetch', dateRange: 'week' };
      } else if (selectedDateRange === 'today') {
        const today = format(new Date(), 'yyyy-MM-dd');
        requestBody = { action: 'fetch', date: today };
      } else if (selectedDateRange === 'yesterday') {
        const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
        requestBody = { action: 'fetch', date: yesterday };
      } else {
        const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
        requestBody = { action: 'fetch', date: yesterday };
      }
      
      const response = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      
      if (data.success) {
        if (data.dateRange === 'week') {
          alert(`✅ Week fetch completed!\n\nTotal articles: ${data.totalDeals}\nNew articles: ${data.newDeals}`);
        }
        await loadAllDeals();
        await loadAvailableDates();
      } else {
        const errorMsg = data.error || 'Unknown error';
        if (errorMsg.includes('PERPLEXITY_API_KEY')) {
          alert('🔑 Missing Perplexity API Key\n\nPlease configure your API keys in the environment variables.');
        } else if (errorMsg.includes('OPENAI_API_KEY')) {
          alert('🔑 Missing OpenAI API Key\n\nPlease configure your API keys in the environment variables.');
        }
      }
    } catch (error) {
      console.error('Network error:', error);
    } finally {
      setFetching(false);
    }
  };

  const upvoteArticle = async (articleId: number) => {
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* API Configuration Warning */}
        {(apiStatus?.perplexity === 'missing' || apiStatus?.openai === 'missing' || apiStatus?.supabase === 'missing') && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6 shadow-sm">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-amber-800 mb-2">
                  Configuration Required
                </h3>
                <div className="text-sm text-amber-700 space-y-2">
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
        <div className="text-center border-b border-slate-200 pb-8">
          <h1 className="text-5xl font-light text-slate-800 mb-4 tracking-tight">
            Private Credit Intelligence
          </h1>
          <p className="text-xl text-slate-600 font-light max-w-2xl mx-auto">
            Real-time market intelligence, transaction analysis, and fund activity across global private credit markets
          </p>
        </div>

        {/* Enhanced Controls */}
        <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-end">
            {/* Time Period */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                📅 Time Period
              </label>
              <select
                value={selectedDateRange}
                onChange={(e) => handleDateRangeChange(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 bg-white text-slate-700"
              >
                <option value="all">All News</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">This Week</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                🏷️ Deal Type
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 bg-white text-slate-700"
              >
                <option value="all">All Types</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            {/* Region Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                🌍 Region
              </label>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 bg-white text-slate-700"
              >
                <option value="all">All Regions</option>
                {regions.map(region => (
                  <option key={region} value={region}>{getRegionFlag(region)} {region}</option>
                ))}
              </select>
            </div>

            {/* Fetch Button */}
            <div>
              <button
                onClick={fetchNewDeals}
                disabled={fetching || (apiStatus?.perplexity === 'missing' || apiStatus?.openai === 'missing' || apiStatus?.supabase === 'missing')}
                className="w-full px-6 py-3 bg-gradient-to-r from-slate-800 to-slate-700 text-white rounded-lg hover:from-slate-700 hover:to-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all duration-200 shadow-lg"
              >
                {fetching ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyzing...
                  </span>
                ) : (
                  '🔍 Fetch Latest News'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Bar */}
        {!loading && !fetching && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 text-center">
              <div className="text-2xl font-bold text-slate-800">{filteredDeals.length}</div>
              <div className="text-sm text-slate-600">Total Articles</div>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 text-center">
              <div className="text-2xl font-bold text-emerald-600">{categories.length}</div>
              <div className="text-sm text-slate-600">Deal Types</div>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 text-center">
              <div className="text-2xl font-bold text-blue-600">{regions.length}</div>
              <div className="text-sm text-slate-600">Regions</div>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200 text-center">
              <div className="text-2xl font-bold text-purple-600">
                {filteredDeals.reduce((sum, deal) => sum + (deal.upvotes || 0), 0)}
              </div>
              <div className="text-sm text-slate-600">Total Upvotes</div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {(loading || fetching) && (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-slate-600 mb-6"></div>
            <p className="text-xl text-slate-700 font-light mb-2">
              {fetching ? 'Analyzing Global Markets...' : 'Loading Intelligence...'}
            </p>
            <p className="text-sm text-slate-500">
              {fetching ? 'Powered by Perplexity AI and OpenAI' : 'Organizing market data'}
            </p>
          </div>
        )}

        {/* Enhanced News Display */}
        {!loading && !fetching && (
          <div className="space-y-6">
            {filteredDeals.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="text-8xl mb-8 text-slate-300">📊</div>
                <h3 className="text-2xl font-light text-slate-800 mb-4">No Articles Found</h3>
                <p className="text-slate-600 mb-8 font-light max-w-md mx-auto">
                  {selectedCategory !== 'all' || selectedRegion !== 'all' 
                    ? 'Try adjusting your filters or fetch new content'
                    : 'Click "Fetch Latest News" to discover market intelligence'
                  }
                </p>
                <p className="text-sm text-slate-500">
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
                      <article key={deal.id} className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all duration-200">
                        <div className="p-8">
                          {/* Header with badges */}
                          <div className="flex flex-wrap items-start justify-between mb-6 gap-4">
                            <div className="flex-grow">
                              <div className="flex flex-wrap items-center gap-3 mb-4">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${categoryColor}`}>
                                  {type}
                                </span>
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                  {regionFlag} {region}
                                </span>
                                <span className="text-sm text-slate-500 font-light">
                                  {formatDate(deal.date)}
                                </span>
                              </div>
                              <h3 className="text-xl font-semibold text-slate-800 mb-3 leading-tight hover:text-slate-600 transition-colors">
                                {deal.title}
                              </h3>
                            </div>
                            
                            {/* Upvote button */}
                            <div className="flex flex-col items-center">
                              <button
                                onClick={() => upvoteArticle(deal.id)}
                                className="flex flex-col items-center p-3 rounded-xl hover:bg-slate-50 transition-all duration-200 group border border-transparent hover:border-slate-200"
                                title="Upvote this article"
                              >
                                <svg className="w-6 h-6 text-slate-400 group-hover:text-slate-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                                <span className="text-sm font-semibold text-slate-600 mt-1">
                                  {deal.upvotes || 0}
                                </span>
                              </button>
                            </div>
                          </div>
                          
                          {/* Content */}
                          <div className="text-slate-700 leading-relaxed mb-6 font-light text-base">
                            {deal.summary}
                          </div>
                          
                          {/* Footer */}
                          <div className="flex items-center justify-between text-sm text-slate-500 pt-6 border-t border-slate-100">
                            <div className="flex items-center space-x-6">
                              <span className="font-medium">📰 {deal.source}</span>
                              {deal.source_url && (
                                <a 
                                  href={deal.source_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-slate-600 hover:text-slate-800 font-medium transition-colors inline-flex items-center"
                                >
                                  Read Full Article 
                                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              )}
                            </div>
                            <span className="font-light">
                              {format(new Date(deal.created_at), 'MMM d, h:mm a')}
                            </span>
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