import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export async function GET() {
  try {
    const currentTime = new Date();
    const currentHour = currentTime.getUTCHours();
    
    // Calculate next scheduled run time
    let nextRunHour: number;
    let nextRunDescription: string;
    
    if (currentHour < 8) {
      nextRunHour = 8;
      nextRunDescription = "Next morning run: 8:00 AM UTC (3:00 AM EST)";
    } else if (currentHour < 12) {
      nextRunHour = 12; 
      nextRunDescription = "Next midday run: 12:00 PM UTC (7:00 AM EST)";
    } else if (currentHour < 17) {
      nextRunHour = 17;
      nextRunDescription = "Next evening run: 5:00 PM UTC (12:00 PM EST)";
    } else {
      nextRunHour = 8; // Next day morning
      nextRunDescription = "Next morning run: Tomorrow 8:00 AM UTC (3:00 AM EST)";
    }
    
    const nextRun = new Date(currentTime);
    if (currentHour >= 17) {
      // Next run is tomorrow morning
      nextRun.setUTCDate(nextRun.getUTCDate() + 1);
      nextRun.setUTCHours(8, 0, 0, 0);
    } else {
      nextRun.setUTCHours(nextRunHour, 0, 0, 0);
    }
    
    const timeUntilNext = nextRun.getTime() - currentTime.getTime();
    const hoursUntilNext = Math.floor(timeUntilNext / (1000 * 60 * 60));
    const minutesUntilNext = Math.floor((timeUntilNext % (1000 * 60 * 60)) / (1000 * 60));
    
    // Get database statistics
    const db = getDatabase();
    const allDeals = await db.getAllDeals();
    const totalArticles = allDeals.length;
    
    // Get recent articles (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentArticles = allDeals.filter(deal => {
      const dealDate = deal.created_at ? new Date(deal.created_at) : new Date(deal.date || '');
      return dealDate >= sevenDaysAgo;
    });
    
    // Group by date for the last week
    const lastWeekByDate = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayArticles = allDeals.filter(deal => deal.date === dateStr);
      
      if (dayArticles.length > 0 || i === 0) { // Always include today even if empty
        lastWeekByDate.push({
          date: dateStr,
          count: dayArticles.length,
          articles: dayArticles.slice(0, 3).map(deal => ({
            title: deal.title.length > 60 ? deal.title.substring(0, 60) + '...' : deal.title,
            source: deal.source,
            category: deal.category || 'Market News'
          }))
        });
      }
    }
    
    // Find most recent article
    const sortedArticles = allDeals.sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });
    const mostRecentArticle = sortedArticles[0];
    
    const timeSinceCreated = mostRecentArticle && mostRecentArticle.created_at ? 
      Math.floor((currentTime.getTime() - new Date(mostRecentArticle.created_at).getTime()) / (1000 * 60 * 60)) : 0;
    
    return NextResponse.json({
      status: 'active',
      cronSchedule: '3 times daily: 8:00 AM, 12:00 PM, 5:00 PM UTC',
      description: 'Collects private credit deals three times daily to capture more news throughout the day',
      currentTime: currentTime.toISOString(),
      currentTimeUTC: `${currentTime.toISOString().replace('T', ' ').substring(0, 19)} UTC`,
      currentHour: currentHour,
      database: {
        totalArticles,
        recentArticles: recentArticles.length,
        lastWeekByDate
      },
      mostRecentArticle: mostRecentArticle ? {
        title: mostRecentArticle.title,
        date: mostRecentArticle.date,
        source: mostRecentArticle.source,
        category: mostRecentArticle.category || 'Market News',
        createdAt: mostRecentArticle.created_at,
        timeSinceCreated: `${timeSinceCreated} hours ago`
      } : null,
      nextScheduledRun: {
        description: nextRunDescription,
        timeUntilNext: `${hoursUntilNext}h ${minutesUntilNext}m`,
        nextRunTime: nextRun.toISOString()
      },
      dailySchedule: {
        morning: "8:00 AM UTC (3:00 AM EST)",
        midday: "12:00 PM UTC (7:00 AM EST)", 
        evening: "5:00 PM UTC (12:00 PM EST)"
      },
      endpoints: {
        manualTrigger: "/api/cron/manual-trigger (POST)",
        fixSources: "/api/fix-all-sources (POST)",
        healthCheck: "/api/health (GET)"
      }
    });

  } catch (error) {
    console.error('Error getting cron status:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Failed to get cron status',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 