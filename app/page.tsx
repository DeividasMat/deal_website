'use client';

import { useState, useEffect } from 'react';
import { format, subDays } from 'date-fns';

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

export default function Home() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDateRange, setSelectedDateRange] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [apiStatus, setApiStatus] = useState<{perplexity: string, openai: string} | null>(null);

  // Load all deals and check API status on component mount
  useEffect(() => {
    loadAllDeals();
    loadAvailableDates();
    checkApiStatus();
  }, []);

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
      setDeals(data.deals || []);
    } catch (error) {
      console.error('Error loading all deals:', error);
      setDeals([]);
    } finally {
      setLoading(false);
    }
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
      setDeals(data.deals || []);
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
        // Bulk fetch for week
        requestBody = {
          action: 'fetch',
          dateRange: 'week'
        };
      } else if (selectedDateRange === 'today') {
        // Fetch today's news
        const today = format(new Date(), 'yyyy-MM-dd');
        requestBody = {
          action: 'fetch',
          date: today
        };
      } else if (selectedDateRange === 'yesterday') {
        // Fetch yesterday's news
        const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
        requestBody = {
          action: 'fetch',
          date: yesterday
        };
      } else {
        // Default to yesterday
        const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
        requestBody = {
          action: 'fetch',
          date: yesterday
        };
      }
      
      const response = await fetch('/api/deals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      
      if (data.success) {
        if (data.dateRange === 'week') {
          // Bulk fetch completed
          console.log(`Bulk fetch completed: ${data.totalDeals} total articles, ${data.newDeals} new articles`);
          alert(`✅ Week fetch completed!\n\nTotal articles: ${data.totalDeals}\nNew articles: ${data.newDeals}`);
        } else {
          console.log(`Single date fetch completed: ${data.deals?.length || 0} articles`);
        }
        
        // Reload all deals to show the new ones
        await loadAllDeals();
        await loadAvailableDates();
      } else {
        const errorMsg = data.error || 'Unknown error';
        if (errorMsg.includes('PERPLEXITY_API_KEY')) {
          alert('🔑 Missing Perplexity API Key\n\nTo fix this:\n1. Go to https://docs.perplexity.ai/\n2. Get your API key\n3. Add it to environment variables\n4. Restart your app');
        } else if (errorMsg.includes('OPENAI_API_KEY')) {
          alert('🔑 Missing OpenAI API Key\n\nTo fix this:\n1. Go to https://platform.openai.com/\n2. Get your API key\n3. Add it to environment variables\n4. Restart your app');
        } else {
          console.error('Fetch error:', errorMsg);
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'upvote',
          articleId: articleId
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        // Update the local state to reflect the upvote
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
      alert('Failed to vote. Please try again.');
    }
  };

  const handleDateRangeChange = (dateRange: string) => {
    setSelectedDateRange(dateRange);
    loadDealsByDateRange(dateRange);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'EEEE, MMMM d, yyyy');
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* API Configuration Warning */}
        {(apiStatus?.perplexity === 'missing' || apiStatus?.openai === 'missing') && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-amber-800 mb-2">
                  API Configuration Required
                </h3>
                <div className="text-sm text-amber-700 space-y-2">
                  {apiStatus?.perplexity === 'missing' && (
                    <p>
                      🔑 <strong>Missing Perplexity API key</strong> - Get one at{' '}
                      <a href="https://docs.perplexity.ai/" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                        docs.perplexity.ai
                      </a>
                    </p>
                  )}
                  {apiStatus?.openai === 'missing' && (
                    <p>
                      🔑 <strong>Missing OpenAI API key</strong> - Get one at{' '}
                      <a href="https://platform.openai.com/" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                        platform.openai.com
                      </a>
                    </p>
                  )}
                  <p className="text-xs mt-3 text-amber-600">
                    Add these to your .env file and restart the application.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center border-b border-slate-200 pb-8">
          <h1 className="text-4xl font-light text-slate-800 mb-3 tracking-tight">
            Private Credit Intelligence
          </h1>
          <p className="text-lg text-slate-600 font-light">
            Real-time market updates and transaction analysis
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
            <div>
              <label htmlFor="date-range-select" className="block text-sm font-medium text-slate-700 mb-2">
                Time Period
              </label>
              <select
                id="date-range-select"
                value={selectedDateRange}
                onChange={(e) => handleDateRangeChange(e.target.value)}
                className="block w-full px-4 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 bg-white text-slate-700"
              >
                <option value="all">All News</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">This Week</option>
              </select>
            </div>
          </div>

          <button
            onClick={fetchNewDeals}
            disabled={fetching || (apiStatus?.perplexity === 'missing' || apiStatus?.openai === 'missing')}
            className="px-8 py-3 bg-slate-800 text-white rounded-md hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {fetching ? 
              (selectedDateRange === 'week' ? 'Fetching Week News...' :
               selectedDateRange === 'today' ? 'Fetching Today News...' :
               selectedDateRange === 'yesterday' ? 'Fetching Yesterday News...' :
               'Searching for News...') : 
             (apiStatus?.perplexity === 'missing' || apiStatus?.openai === 'missing') ? 
             'Configure API Keys First' : 
             (selectedDateRange === 'week' ? 'Fetch This Week' :
              selectedDateRange === 'today' ? 'Fetch Today' :
              selectedDateRange === 'yesterday' ? 'Fetch Yesterday' :
              'Find Latest News')}
          </button>
        </div>

        {/* Loading/Fetching State */}
        {(loading || fetching) && (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-4 border-slate-600"></div>
            <p className="mt-6 text-lg text-slate-700 font-light">
              {fetching ? 'Analyzing market intelligence...' : 'Loading articles...'}
            </p>
            {fetching && (
              <p className="mt-2 text-sm text-slate-500">
                Powered by Perplexity AI and OpenAI
              </p>
            )}
          </div>
        )}

        {/* News Display */}
        {!loading && !fetching && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-light text-slate-800">
                Market Intelligence
              </h2>
              <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {deals.length} articles
              </span>
            </div>

            {deals.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-lg shadow-sm border border-slate-200">
                <div className="text-6xl mb-6 text-slate-300">📊</div>
                <h3 className="text-xl font-light text-slate-800 mb-3">No Articles Available</h3>
                <p className="text-slate-600 mb-6 font-light">
                  Click "Find Latest News" to discover market updates and transaction announcements
                </p>
                <p className="text-sm text-slate-500">
                  AI-powered analysis from multiple financial sources
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                {deals
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((deal, index) => (
                  <div key={deal.id}>
                    <article className="p-8">
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex-grow">
                          <h3 className="text-xl font-medium text-slate-800 mb-3 leading-tight">
                            {deal.title}
                          </h3>
                          <div className="text-sm text-slate-500 mb-4 font-light">
                            {formatDate(deal.date)}
                          </div>
                        </div>
                        <div className="flex flex-col items-center ml-8">
                          <button
                            onClick={() => upvoteArticle(deal.id)}
                            className="flex flex-col items-center p-3 rounded-lg hover:bg-slate-50 transition-colors group"
                            title="Upvote this article"
                          >
                            <svg className="w-5 h-5 text-slate-400 group-hover:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                            <span className="text-sm font-medium text-slate-500 mt-1">
                              {deal.upvotes || 0}
                            </span>
                          </button>
                        </div>
                      </div>
                      
                      <div className="text-slate-700 leading-relaxed mb-6 font-light text-base">
                        {deal.summary}
                      </div>
                      
                      <div className="flex items-center justify-between text-sm text-slate-500 pt-4 border-t border-slate-100">
                        <div className="flex items-center space-x-6">
                          <span className="font-light">Source: {deal.source}</span>
                          {deal.source_url && (
                            <a 
                              href={deal.source_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-slate-600 hover:text-slate-800 underline font-medium transition-colors"
                            >
                              Read Full Article →
                            </a>
                          )}
                        </div>
                        <span className="font-light">
                          {format(new Date(deal.created_at), 'MMM d, h:mm a')}
                        </span>
                      </div>
                    </article>
                    
                    {/* Elegant divider line between articles */}
                    {index < deals.length - 1 && (
                      <hr className="border-slate-100" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 