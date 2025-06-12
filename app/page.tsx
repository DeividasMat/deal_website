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

  // Load available dates on component mount
  useEffect(() => {
    loadAvailableDates();
  }, []);

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
      
      // Set today's date as default if no dates available
      if (data.dates && data.dates.length > 0) {
        setSelectedDate(data.dates[0]);
      } else {
        const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
        setSelectedDate(yesterday);
      }
    } catch (error) {
      console.error('Error loading dates:', error);
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
        alert('Failed to fetch deals: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error fetching deals:', error);
      alert('Error fetching deals. Please try again.');
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
          disabled={fetching || !selectedDate}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {fetching ? 'Fetching...' : 'Fetch Latest Deals'}
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading deals...</p>
        </div>
      )}

      {/* Deals Display */}
      {!loading && selectedDate && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Private Credit Deals for {formatDate(selectedDate)}
          </h2>

          {deals.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-lg shadow">
              <p className="text-gray-500">No deals found for this date.</p>
              <p className="text-sm text-gray-400 mt-1">
                Try fetching the latest deals or select a different date.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {deals.map((deal) => (
                <div key={deal.id} className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {deal.title}
                  </h3>
                  <div className="text-gray-600 whitespace-pre-wrap mb-4">
                    {deal.summary}
                  </div>
                  <div className="flex justify-between items-center text-sm text-gray-500">
                    <span>Source: {deal.source}</span>
                    <span>
                      Updated: {format(new Date(deal.created_at), 'h:mm a')}
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