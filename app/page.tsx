'use client';

import { useState, useEffect } from 'react';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';

interface Deal {
  id?: number;
  date: string;
  title: string;
  summary: string;
  content: string;
  source: string;
  source_url?: string;
  category: string;
  upvotes?: number;
  created_at?: string;
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

// Function to convert markdown-style bold formatting to HTML
const formatSummaryWithBold = (summary: string): React.ReactNode => {
  const parts = summary.split(/(\*\*.*?\*\*)/g);
  
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      // Remove the ** markers and make it bold
      const boldText = part.slice(2, -2);
      return <strong key={index} className="font-semibold text-gray-900">{boldText}</strong>;
    }
    return part;
  });
};

// Apple-style category badge mapping
const getCategoryBadge = (type: string): string => {
  const badges: { [key: string]: string } = {
    'Fund Raising': 'apple-badge-green',
    'Private Equity': 'apple-badge-blue',
    'Credit Facility': 'apple-badge-purple',
    'M&A': 'apple-badge-orange',
    'Public Markets': 'apple-badge-blue',
    'Distressed': 'apple-badge-orange',
    'Real Estate': 'apple-badge-green',
    'Infrastructure': 'apple-badge-purple',
    'Market News': 'apple-badge-gray',
    'Deal Activity': 'apple-badge-blue',
  };
  return badges[type] || 'apple-badge-gray';
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
  const [newDealsCount, setNewDealsCount] = useState<number>(0);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isPolling, setIsPolling] = useState<boolean>(true);
  const [isManualRefreshing, setIsManualRefreshing] = useState<boolean>(false);

  // Load all deals and check API status on component mount
  useEffect(() => {
    handleDateRangeChange('all');
    loadAvailableDates();
    checkApiStatus();
  }, []);

  // Auto-refresh deals every 15 seconds (reduced from 30)
  useEffect(() => {
    if (!isPolling) return;

    console.log(`🔄 Auto-refresh enabled for range '${selectedDateRange}' - checking every 15 seconds`);
    
    const interval = setInterval(async () => {
      try {
        console.log(`⏰ Auto-refresh triggered at ${new Date().toISOString()}`);
        await refreshDealsQuietly();
      } catch (error) {
        console.error('❌ Error in auto-refresh:', error);
      }
    }, 15000); // 15 seconds (reduced from 30)

    return () => {
      console.log('🛑 Auto-refresh interval cleared');
      clearInterval(interval);
    };
  }, [selectedDateRange, isPolling]);

  // Filter deals when filters change
  useEffect(() => {
    filterDeals();
  }, [deals, selectedCategory, selectedRegion]);

  // Clear new deals notification after 5 seconds
  useEffect(() => {
    if (newDealsCount > 0) {
      const timer = setTimeout(() => {
        setNewDealsCount(0);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [newDealsCount]);

  const refreshDealsQuietly = async () => {
    try {
      // Add cache busting with timestamp
      const timestamp = Date.now();
      const url = `/api/deals/all?t=${timestamp}&cb=${Math.random()}`;
      
      console.log(`🔄 Frontend: Refreshing deals at ${new Date().toISOString()}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const allDeals = data.deals || [];
      
      console.log(`📊 Frontend: Received ${allDeals.length} deals from API`);
      console.log(`🎯 Latest deal: ${allDeals.length > 0 ? `${allDeals[0]?.title?.substring(0, 50)}... (${allDeals[0]?.date})` : 'No deals'}`);
      
      // Filter by date range
      const now = new Date();
      let filteredByDate = allDeals;
      
      switch (selectedDateRange) {
        case 'today':
          filteredByDate = allDeals.filter((deal: Deal) => isToday(new Date(deal.date)));
          break;
        case 'yesterday':
          filteredByDate = allDeals.filter((deal: Deal) => isYesterday(new Date(deal.date)));
          break;
        case '2days':
          const twoDaysAgo = new Date();
          twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
          filteredByDate = allDeals.filter((deal: Deal) => new Date(deal.date) >= twoDaysAgo);
          break;
        case 'week':
          filteredByDate = allDeals.filter((deal: Deal) => isThisWeek(new Date(deal.date)));
          break;
        case 'lastweek':
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          filteredByDate = allDeals.filter((deal: Deal) => new Date(deal.date) >= weekAgo);
          break;
        case 'all':
        default:
          filteredByDate = allDeals.slice(0, 100);
          break;
      }
      
      console.log(`🔽 Frontend: Filtered to ${filteredByDate.length} deals for range '${selectedDateRange}'`);
      
      // Remove duplicates and sort
      const uniqueDeals = removeDuplicatesAggressive(filteredByDate);
      const sortedDeals = uniqueDeals.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      // Check for new deals
      const currentDealsCount = deals.length;
      const newDealsFoundCount = sortedDeals.length - currentDealsCount;
      
      if (newDealsFoundCount > 0) {
        console.log(`🎉 Found ${newDealsFoundCount} new deals!`);
        setNewDealsCount(newDealsFoundCount);
        setLastRefresh(new Date());
      }
      
      setDeals(sortedDeals);
      console.log(`✅ Frontend: Updated state with ${sortedDeals.length} deals`);
    } catch (error) {
      console.error('❌ Error in quiet refresh:', error);
    }
  };

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
      // Add cache busting with timestamp
      const timestamp = Date.now();
      const url = `/api/deals/all?t=${timestamp}&cb=${Math.random()}`;
      
      console.log(`🔄 Frontend: Loading all deals at ${new Date().toISOString()}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Get all deals without date filtering
      const allDeals = data.deals || [];
      
      console.log(`📊 Frontend: Loaded ${allDeals.length} deals from API`);
      console.log(`🎯 Latest deal: ${allDeals.length > 0 ? `${allDeals[0]?.title?.substring(0, 50)}... (${allDeals[0]?.date})` : 'No deals'}`);
      
      // Remove duplicates and sort by date (newest first)
      const uniqueDeals = removeDuplicatesAggressive(allDeals);
      const sortedDeals = uniqueDeals.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setDeals(sortedDeals);
      console.log(`✅ Frontend: Set ${sortedDeals.length} deals in state`);
    } catch (error) {
      console.error('❌ Error loading all deals:', error);
      setDeals([]);
    } finally {
      setLoading(false);
    }
  };

  // Aggressive duplicate removal - remove duplicates even from different sources
  const removeDuplicatesAggressive = (deals: Deal[]): Deal[] => {
    const seen = new Map<string, Deal>();
    
    deals.forEach(deal => {
      // More aggressive normalization
      const normalizedTitle = deal.title.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .replace(/\b(inc|ltd|llc|corp|company|fund|capital|management|group)\b/g, '')
        .trim();
      
      // Also check for similar content in summary
      const normalizedSummary = deal.summary.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      const key = normalizedTitle;
      
      // Keep the one with more content, higher upvotes, or more recent
      if (!seen.has(key)) {
        seen.set(key, deal);
      } else {
        const existing = seen.get(key)!;
        const dealScore = (deal.upvotes || 0) + deal.summary.length + (new Date(deal.date).getTime() / 1000000);
        const existingScore = (existing.upvotes || 0) + existing.summary.length + (new Date(existing.date).getTime() / 1000000);
        
        if (dealScore > existingScore) {
          seen.set(key, deal);
        }
      }
    });
    
    return Array.from(seen.values());
  };

  const filterDeals = () => {
    let filtered = [...deals];

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(deal => {
        const { type } = categorizeArticle(deal);
        return type === selectedCategory;
      });
    }

    // Filter by region
    if (selectedRegion !== 'all') {
      filtered = filtered.filter(deal => {
        const { region } = categorizeArticle(deal);
        return region === selectedRegion;
      });
    }

    setFilteredDeals(filtered);
  };

  const handleDateRangeChange = async (range: string) => {
    setSelectedDateRange(range);
    setLoading(true);

    try {
      const response = await fetch('/api/deals/all');
      const data = await response.json();
      const allDeals = data.deals || [];
      
      const now = new Date();
      let filteredByDate = allDeals;
      
      switch (range) {
        case 'today':
          filteredByDate = allDeals.filter((deal: Deal) => isToday(new Date(deal.date)));
          break;
        case 'yesterday':
          filteredByDate = allDeals.filter((deal: Deal) => isYesterday(new Date(deal.date)));
          break;
        case '2days':
          const twoDaysAgo = new Date();
          twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
          filteredByDate = allDeals.filter((deal: Deal) => new Date(deal.date) >= twoDaysAgo);
          break;
        case 'week':
          filteredByDate = allDeals.filter((deal: Deal) => isThisWeek(new Date(deal.date)));
          break;
        case 'lastweek':
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          filteredByDate = allDeals.filter((deal: Deal) => new Date(deal.date) >= weekAgo);
          break;
        case 'all':
        default:
          // Show newest 100 for "all time"
          filteredByDate = allDeals.slice(0, 100);
          break;
      }
      
      // Remove duplicates and sort
      const uniqueDeals = removeDuplicatesAggressive(filteredByDate);
      const sortedDeals = uniqueDeals.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setDeals(sortedDeals);
    } finally {
      setLoading(false);
    }
  };

  const handleUpvote = async (dealId?: number) => {
    if (!dealId || upvoting === dealId) return;
    
    setUpvoting(dealId);
    try {
      const response = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upvote', articleId: dealId }),
      });

      if (response.ok) {
        // Update local state
        setDeals(prev => prev.map(deal => 
          deal.id === dealId 
            ? { ...deal, upvotes: (deal.upvotes || 0) + 1 }
            : deal
        ));
      }
    } catch (error) {
      console.error('Error upvoting:', error);
    } finally {
      setUpvoting(null);
    }
  };

  // Show only date, no time
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMM d, yyyy');
  };

  // Get unique categories and regions for filters
  const categories = Array.from(new Set(deals.map(deal => categorizeArticle(deal).type))).sort();
  const regions = Array.from(new Set(deals.map(deal => categorizeArticle(deal).region))).sort();

  return (
    <div className="min-h-screen bg-white">
      <div className="apple-container">
        
        {/* New Deals Notification */}
        {newDealsCount > 0 && (
          <div className="fixed top-4 right-4 z-50 animate-pulse">
            <div className="apple-card p-4 bg-green-50 border-green-200 shadow-lg">
              <div className="flex items-center space-x-3">
                <div className="text-green-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-green-800">
                    {newDealsCount} new deal{newDealsCount > 1 ? 's' : ''} added!
                  </p>
                  <p className="text-xs text-green-600">
                    Updated {format(lastRefresh, 'h:mm:ss a')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Auto-refresh Status */}
        <div className="fixed bottom-4 right-4 z-40">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsPolling(!isPolling)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isPolling 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isPolling ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                <span>{isPolling ? 'Auto-refresh ON' : 'Auto-refresh OFF'}</span>
              </div>
            </button>
            
            <button
              onClick={async () => {
                setIsManualRefreshing(true);
                console.log('🔄 Manual refresh triggered by user');
                try {
                  await refreshDealsQuietly();
                  console.log('✅ Manual refresh completed successfully');
                } catch (error) {
                  console.error('❌ Manual refresh failed:', error);
                } finally {
                  setIsManualRefreshing(false);
                }
              }}
              disabled={isManualRefreshing}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isManualRefreshing 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }`}
            >
              <div className="flex items-center space-x-2">
                <svg 
                  className={`w-4 h-4 ${isManualRefreshing ? 'animate-spin' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{isManualRefreshing ? 'Refreshing...' : 'Refresh Now'}</span>
              </div>
            </button>
          </div>
        </div>

        {/* API Configuration Warning */}
        {(apiStatus?.perplexity === 'missing' || apiStatus?.openai === 'missing' || apiStatus?.supabase === 'missing') && (
          <div className="apple-space-md">
            <div className="apple-card" style={{ background: 'rgba(255, 149, 0, 0.05)', borderColor: 'var(--apple-orange)' }}>
              <div className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="text-2xl">⚠️</div>
                  <div>
                    <h3 className="apple-headline text-lg mb-2">Setup Required</h3>
                    <div className="apple-body space-y-2">
                      {apiStatus?.supabase === 'missing' && (
                        <p>🗄️ Missing Supabase configuration</p>
                      )}
                      {apiStatus?.perplexity === 'missing' && (
                        <p>🔑 Missing Perplexity API key</p>
                      )}
                      {apiStatus?.openai === 'missing' && (
                        <p>🔑 Missing OpenAI API key</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <div className="relative py-16 pb-40">
          <div className="text-center">
            <a 
              href="https://privatecreditpulse.substack.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-block"
            >
              <h1 className="apple-title text-4xl mb-8 hover:opacity-80 transition-opacity cursor-pointer">
                Private Credit Pulse
              </h1>
            </a>
          </div>
          
          {/* Substack Embed - Right Corner */}
          <div className="absolute top-8 right-0 hidden lg:block">
            <div className="apple-card-minimal p-3 rounded-lg mb-8">
              <iframe 
                src="https://privatecreditpulse.substack.com/embed?simple=true" 
                width="300" 
                height="180" 
                style={{ border: '1px solid #EEE', background: 'white', borderRadius: '8px' }} 
                frameBorder="0" 
                scrolling="no"
                title="Newsletter Signup"
              />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-8">
          <div className="apple-card p-6">
            <div className="mb-6">
              <h2 className="apple-headline text-lg mb-1">Filters</h2>
              <p className="apple-caption">
                {selectedDateRange === 'all' ? 'Showing all articles' : 
                 selectedDateRange === 'today' ? 'Showing today\'s articles' :
                 selectedDateRange === 'yesterday' ? 'Showing yesterday\'s articles' :
                 selectedDateRange === '2days' ? 'Showing articles from last 2 days' :
                 selectedDateRange === 'week' ? 'Showing articles from this week' :
                 selectedDateRange === 'lastweek' ? 'Showing articles from last week' :
                 'Showing filtered articles'}
                 {isPolling && <span className="ml-2 text-green-600">• Live updates enabled</span>}
              </p>
            </div>
            
            <div className="apple-grid apple-grid-3">
              {/* Time Period */}
              <div>
                <label className="block apple-caption mb-3">Time Period</label>
                <select
                  value={selectedDateRange}
                  onChange={(e) => handleDateRangeChange(e.target.value)}
                  className="apple-select w-full"
                >
                  <option value="all">All Time</option>
                  <option value="2days">Last 2 Days</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="week">This Week</option>
                  <option value="lastweek">Last Week</option>
                </select>
              </div>

              {/* Transaction Type */}
              <div>
                <label className="block apple-caption mb-3">Transaction Type</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="apple-select w-full"
                >
                  <option value="all">All Types</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              {/* Region */}
              <div>
                <label className="block apple-caption mb-3">Region</label>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="apple-select w-full"
                >
                  <option value="all">Global</option>
                  {regions.map(region => (
                    <option key={region} value={region}>{getRegionFlag(region)} {region}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics */}
        {!loading && (
          <div className="mb-8">
            <div className="apple-grid apple-grid-4">
              <div className="apple-stat-card py-4">
                <div className="text-2xl font-bold apple-title mb-1">{filteredDeals.length}</div>
                <div className="apple-caption">Articles</div>
              </div>
              <div className="apple-stat-card py-4">
                <div className="text-2xl font-bold apple-title mb-1" style={{ color: 'var(--apple-green)' }}>{categories.length}</div>
                <div className="apple-caption">Deal Types</div>
              </div>
              <div className="apple-stat-card py-4">
                <div className="text-2xl font-bold apple-title mb-1" style={{ color: 'var(--apple-blue)' }}>{regions.length}</div>
                <div className="apple-caption">Regions</div>
              </div>
              <div className="apple-stat-card py-4">
                <div className="text-2xl font-bold apple-title mb-1" style={{ color: 'var(--apple-orange)' }}>
                  {filteredDeals.reduce((sum, deal) => sum + (deal.upvotes || 0), 0)}
                </div>
                <div className="apple-caption">Upvotes</div>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="apple-section text-center">
            <div className="apple-spinner mx-auto mb-6"></div>
            <p className="apple-headline text-xl mb-2">Loading Intelligence</p>
            <p className="apple-caption">Organizing market data</p>
          </div>
        )}

        {/* Articles */}
        {!loading && (
          <div>
            {filteredDeals.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-8xl mb-8 opacity-20">📊</div>
                <h3 className="apple-headline text-2xl mb-4">No Articles Found</h3>
                <p className="apple-body max-w-md mx-auto">
                  {selectedCategory !== 'all' || selectedRegion !== 'all' 
                    ? 'Try adjusting your filters to see more content'
                    : 'No articles match your current criteria'
                  }
                </p>
              </div>
            ) : (
              <div className="apple-grid gap-6">
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
                    const badgeClass = getCategoryBadge(type);
                    const regionFlag = getRegionFlag(region);
                    
                    return (
                      <article key={deal.id} className="apple-card p-8">
                        {/* Header */}
                        <div className="flex justify-between items-start mb-6">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-4">
                              <span className={`apple-badge ${badgeClass}`}>
                                {type}
                              </span>
                              <span className="apple-badge apple-badge-gray">
                                {regionFlag} {region}
                              </span>
                              <span className="apple-small">
                                {formatDate(deal.date)}
                              </span>
                            </div>
                            <h3 className="apple-headline text-xl mb-3 leading-tight">
                              {deal.title}
                            </h3>
                          </div>
                          
                          {/* Upvote */}
                          <button
                            onClick={() => handleUpvote(deal.id)}
                            disabled={upvoting === deal.id}
                            className="ml-6 flex flex-col items-center p-3 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                          >
                            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                            <span className="apple-small font-medium">{deal.upvotes || 0}</span>
                          </button>
                        </div>
                        
                        {/* Article Source Link - Above Content */}
                        {deal.source_url && (
                          <div className="mb-4">
                            <a 
                              href={deal.source_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-medium rounded-lg transition-colors"
                            >
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                              Read Original Article
                            </a>
                          </div>
                        )}
                        
                        {/* Content */}
                        <div className="apple-body mb-6 leading-relaxed">
                          {formatSummaryWithBold(deal.summary)}
                        </div>
                        
                        {/* Footer */}
                        <div className="pt-4 border-t border-gray-100">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center space-x-4">
                              <span className="apple-small text-gray-500">
                                Source: {deal.source}
                              </span>
                            </div>
                            <span className="apple-small">
                              {deal.created_at && format(new Date(deal.created_at), 'MMM d, h:mm a')}
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