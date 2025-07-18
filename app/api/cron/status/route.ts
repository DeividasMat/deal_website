import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { format } from 'date-fns';

export async function GET() {
  try {
    const db = getDatabase();
    const allDeals = await db.getAllDeals();
    
    // Get recent articles (last 7 days)
    const recentDeals = allDeals
      .filter(deal => {
        if (!deal.date) return false;
        const dealDate = new Date(deal.date);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return dealDate >= weekAgo;
      })
      .sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });

    // Group by date
    const dealsByDate: { [key: string]: any[] } = {};
    recentDeals.forEach(deal => {
      const dateKey = deal.date;
      if (!dealsByDate[dateKey]) {
        dealsByDate[dateKey] = [];
      }
      dealsByDate[dateKey].push(deal);
    });

    // Get the most recent article
    const mostRecent = recentDeals[0];
    
    return NextResponse.json({
      status: 'active',
      cronSchedule: '0 17 * * * (5 PM UTC daily)',
      description: 'Collects private credit deals daily at 5 PM UTC',
      currentTime: new Date().toISOString(),
      currentTimeUTC: format(new Date(), 'yyyy-MM-dd HH:mm:ss') + ' UTC',
      
      database: {
        totalArticles: allDeals.length,
        recentArticles: recentDeals.length,
        lastWeekByDate: Object.keys(dealsByDate).map(date => ({
          date,
          count: dealsByDate[date].length,
          articles: dealsByDate[date].slice(0, 3).map(deal => ({
            title: deal.title.substring(0, 60) + '...',
            source: deal.source,
            category: deal.category
          }))
        }))
      },
      
      mostRecentArticle: mostRecent ? {
        title: mostRecent.title,
        date: mostRecent.date,
        source: mostRecent.source,
        category: mostRecent.category,
        createdAt: mostRecent.created_at,
        timeSinceCreated: mostRecent.created_at ? 
          Math.round((new Date().getTime() - new Date(mostRecent.created_at).getTime()) / (1000 * 60 * 60)) + ' hours ago' :
          'Unknown'
      } : null,
      
      nextScheduledRun: {
        description: 'Next 5 PM UTC (17:00)',
        timeUntilNext: calculateTimeUntilNext5PM()
      },
      
      endpoints: {
        manualTrigger: '/api/cron/manual-trigger (POST)',
        fixSources: '/api/fix-all-sources (POST)',
        healthCheck: '/api/health (GET)'
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      currentTime: new Date().toISOString()
    }, { status: 500 });
  }
}

function calculateTimeUntilNext5PM(): string {
  const now = new Date();
  const next5PM = new Date(now);
  
  // Set to 5 PM UTC today
  next5PM.setUTCHours(17, 0, 0, 0);
  
  // If it's already past 5 PM today, set to 5 PM tomorrow
  if (now.getTime() >= next5PM.getTime()) {
    next5PM.setUTCDate(next5PM.getUTCDate() + 1);
  }
  
  const diff = next5PM.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  return `${hours}h ${minutes}m`;
} 