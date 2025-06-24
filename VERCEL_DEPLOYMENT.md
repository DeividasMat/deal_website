# Vercel Deployment with Automated Daily News Collection

## 🚀 Deploy to Vercel with Automated Scheduling

Your system now includes **Vercel Cron Jobs** that will automatically fetch news every day at **12:00 PM EST**.

### 1. Prepare for Deployment

```bash
# Make sure you're in the project directory
cd deal_website

# Build the project to check for errors
npm run build
```

### 2. Deploy to Vercel

#### Option A: Using Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

#### Option B: Using GitHub (Recommended)
1. Push your code to GitHub
2. Connect GitHub repo to Vercel
3. Vercel will auto-deploy on push

### 3. Configure Environment Variables on Vercel

In your **Vercel Dashboard → Settings → Environment Variables**, add:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# AI Services
PERPLEXITY_API_KEY=your_perplexity_api_key
OPENAI_API_KEY=your_openai_api_key

# Cron Security (generate a random string)
CRON_SECRET=your_random_secret_string_here
```

### 4. Automated Daily Schedule

**✅ AUTOMATIC**: Once deployed, Vercel will run the cron job:
- **Time**: Every day at 12:00 PM EST (5:00 PM UTC)
- **Action**: Fetch news for the previous day
- **Endpoint**: `/api/cron/daily-news`
- **Security**: Protected by CRON_SECRET

### 5. Manual News Fetching

You can still manually fetch news anytime:

```bash
# Fetch today's news
curl -X POST https://your-app.vercel.app/api/deals \
  -H "Content-Type: application/json" \
  -d '{"action": "fetch", "date": "2024-12-24"}'

# Fetch entire week
curl -X POST https://your-app.vercel.app/api/deals \
  -H "Content-Type: application/json" \
  -d '{"action": "fetch", "dateRange": "week"}'
```

### 6. Test the Cron Job

```bash
# Test the cron endpoint manually
curl -X GET https://your-app.vercel.app/api/cron/daily-news \
  -H "Authorization: Bearer your_cron_secret"
```

### 7. Monitor Cron Jobs

In Vercel Dashboard:
1. Go to **Functions** tab
2. Click on `/api/cron/daily-news`
3. View **Invocations** to see execution logs

### 8. Alternative Scheduling Methods

If Vercel Cron doesn't work, use these alternatives:

#### Option A: GitHub Actions
```yaml
# .github/workflows/daily-news.yml
name: Daily News Collection
on:
  schedule:
    - cron: '0 17 * * *'  # 12 PM EST
jobs:
  fetch-news:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger News Fetch
        run: |
          curl -X GET ${{ secrets.VERCEL_URL }}/api/cron/daily-news \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

#### Option B: External Cron Service
Use services like:
- **cron-job.org** (free)
- **EasyCron** 
- **Zapier** (scheduled zaps)

Set them to call: `https://your-app.vercel.app/api/cron/daily-news`

### 9. Troubleshooting

**Cron not running?**
- Check Vercel Function logs
- Verify CRON_SECRET environment variable
- Ensure Supabase tables are created

**API timeouts?**
- Functions have 5-minute limit (already configured)
- Monitor execution time in Vercel dashboard

**Environment variables missing?**
- Re-deploy after adding environment variables
- Check they're available in all environments

### 10. Success Indicators

✅ **Deployment successful**: App loads at vercel.app URL  
✅ **Database connected**: Health check shows Supabase ✓  
✅ **Cron scheduled**: Vercel dashboard shows cron job  
✅ **News collecting**: New articles appear daily  

## 🎯 Final Result

After deployment, your system will:
1. **Automatically fetch news** every day at 12 PM EST
2. **Save to Supabase** with duplicate detection
3. **Display in dashboard** with real-time updates
4. **Scale automatically** on Vercel infrastructure

Your private credit intelligence platform is now fully automated! 🚀 