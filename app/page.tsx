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
  created_at: string;
}

export default function Home() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [apiStatus, setApiStatus] = useState<{perplexity: string, openai: string} | null>(null);

  // Load available dates and check API status on component mount
  useEffect(() => {
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

  // Load deals when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      loadDeals(selectedDate);
    }
  }, [selectedDate]);

  const loadAvailableDates = async () => {
    try {
      const response = await fetch('/api/deals');
      const data = await response.json();
      setAvailableDates(data.dates || []);
      
      // Always set yesterday as default for immediate searching
      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      setSelectedDate(yesterday);
    } catch (error) {
      console.error('Error loading dates:', error);
      // Still set yesterday as default even if API fails
      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      setSelectedDate(yesterday);
    }
  };

  const loadDeals = async (date: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/deals?date=${date}`);
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
      const response = await fetch('/api/deals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'fetch',
          date: selectedDate
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setDeals(data.deals || []);
        // Refresh available dates
        await loadAvailableDates();
      } else {
        const errorMsg = data.error || 'Unknown error';
        if (errorMsg.includes('PERPLEXITY_API_KEY')) {
          alert('🔑 Missing Perplexity API Key\n\nTo fix this:\n1. Go to https://docs.perplexity.ai/\n2. Get your API key\n3. Add it to Vercel environment variables\n4. Redeploy your app');
        } else if (errorMsg.includes('OPENAI_API_KEY')) {
          alert('🔑 Missing OpenAI API Key\n\nTo fix this:\n1. Go to https://platform.openai.com/\n2. Get your API key\n3. Add it to Vercel environment variables\n4. Redeploy your app');
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

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'EEEE, MMMM d, yyyy');
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      {/* API Configuration Warning */}
      {(apiStatus?.perplexity === 'missing' || apiStatus?.openai === 'missing') && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-2xl">⚠️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-yellow-800">
                API Configuration Required
              </h3>
                             <div className="mt-2 text-sm text-yellow-700">
                 {apiStatus?.perplexity === 'missing' && (
                   <p className="mb-2">
                     🔑 <strong>Missing Perplexity API key</strong> - Get one at{' '}
                     <a href="https://docs.perplexity.ai/" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                       docs.perplexity.ai
                     </a>
                   </p>
                 )}
                 {apiStatus?.openai === 'missing' && (
                   <p className="mb-2">
                     🔑 <strong>Missing OpenAI API key</strong> - Get one at{' '}
                     <a href="https://platform.openai.com/" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                       platform.openai.com
                     </a>
                   </p>
                 )}
                <p className="text-xs mt-2">
                  Add these to your Vercel environment variables and redeploy to start finding deals.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div>
            <label htmlFor="date-select" className="block text-sm font-medium text-gray-700 mb-1">
              Select Date:
            </label>
            <select
              id="date-select"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a date...</option>
              {availableDates.map((date) => (
                <option key={date} value={date}>
                  {formatDate(date)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={fetchNewDeals}
          disabled={fetching || !selectedDate || (apiStatus?.perplexity === 'missing' || apiStatus?.openai === 'missing')}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-lg font-medium"
        >
          {fetching ? '🔍 Searching for Deals...' : 
           (apiStatus?.perplexity === 'missing' || apiStatus?.openai === 'missing') ? 
           '🔑 Configure API Keys First' : 
           '🚀 Find Private Credit Deals'}
        </button>
      </div>

      {/* Loading/Fetching State */}
      {(loading || fetching) && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
          <p className="mt-4 text-lg text-gray-700">
            {fetching ? 'Searching for private credit deals...' : 'Loading deals...'}
          </p>
          {fetching && (
            <p className="mt-2 text-sm text-gray-500">
              Using Perplexity AI to find the latest announcements
            </p>
          )}
        </div>
      )}

      {/* Deals Display */}
      {!loading && !fetching && selectedDate && (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-gray-900">
            Private Credit Deals for {formatDate(selectedDate)}
          </h2>

          {deals.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Find Deals</h3>
              <p className="text-gray-500 mb-4">
                Click "Find Private Credit Deals" to search for the latest announcements
              </p>
              <p className="text-sm text-gray-400">
                The system will search multiple sources including Bloomberg, Reuters, PEI News, and industry publications
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {deals.map((deal) => (
                <div key={deal.id} className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    {deal.title}
                  </h3>
                  <div className="text-gray-700 whitespace-pre-wrap mb-4 leading-relaxed">
                    {deal.summary}
                  </div>
                  <div className="flex justify-between items-center text-sm text-gray-500 pt-3 border-t">
                    <span className="font-medium">Source: {deal.source}</span>
                    <span>
                      Updated: {format(new Date(deal.created_at), 'MMM d, h:mm a')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 