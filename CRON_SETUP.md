# Setting Up Automatic Data Fetching

Since Vercel cron jobs are not working reliably, here are alternative solutions:

## Option 1: Built-in Auto-Fetch (Already Implemented)

The website now automatically checks and fetches new data:
- **When**: Every time someone visits the website
- **Frequency**: If more than 3 hours have passed since last fetch
- **How**: Automatically triggers background fetch when page loads

This is already working! Just visit your website and it will auto-fetch.

## Option 2: Free External Cron Service (Recommended)

Use a free service like **cron-job.org** to trigger your endpoint:

### Steps:
1. Go to https://cron-job.org and create a free account
2. Create a new cron job with these settings:
   - **URL**: `https://your-app.vercel.app/api/cron/manual-trigger`
   - **Schedule**: Every 4 hours (or your preference)
   - **Method**: POST
   - **Request Body**: `{"date": "today"}`

### Alternative Free Services:
- **EasyCron**: https://www.easycron.com (Free tier: 1 cron job)
- **UptimeRobot**: https://uptimerobot.com (Can trigger endpoints)
- **Cronitor**: https://cronitor.io (Free tier available)

## Option 3: GitHub Actions (Most Reliable)

Create `.github/workflows/fetch-news.yml`:

```yaml
name: Fetch Daily News

on:
  schedule:
    # Run at 8 AM, 12 PM, and 5 PM UTC daily
    - cron: '0 8,12,17 * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  fetch-news:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger News Fetch
        run: |
          curl -X POST https://your-app.vercel.app/api/cron/manual-trigger \
            -H "Content-Type: application/json" \
            -d '{"date": "today"}'
```

## Option 4: Local Script (For Testing)

Run this on your computer to trigger fetches:

```bash
# Save as fetch-news.sh
while true; do
  echo "Fetching news at $(date)"
  curl -X POST https://your-app.vercel.app/api/cron/manual-trigger
  sleep 14400 # Wait 4 hours
done
```

## Monitoring

Check if automatic fetching is working:
1. Visit: `https://your-app.vercel.app/api/auto-fetch`
2. Check the response for last fetch time
3. Visit: `https://your-app.vercel.app/api/cron/status`
4. Check database article counts

## Manual Trigger

You can always manually trigger a fetch:
```bash
curl -X POST https://your-app.vercel.app/api/cron/manual-trigger
```

## Troubleshooting

If data isn't showing:
1. Check Vercel environment variables are set
2. Check API keys are valid
3. Look at Vercel function logs for errors
4. Try manual trigger to test

The auto-fetch mechanism should now work automatically when users visit your site!
