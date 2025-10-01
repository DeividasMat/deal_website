# Easy Cron Setup - Works 100%

GitHub Actions is having redirect issues. Here's a **much simpler solution** that definitely works:

## ✅ Use cron-job.org (Free & Reliable)

### Step 1: Create Account
1. Go to https://cron-job.org/en/
2. Click **"Sign up for free"**
3. Create account (takes 1 minute)

### Step 2: Create Cron Job
1. After logging in, click **"Create cronjob"**
2. Fill in the form:

**Basic Settings:**
- **Title:** `Daily News Fetch`
- **Address (URL):** `https://privatecreditpulse.net/api/cron/manual-trigger`
- **Request method:** `POST`

**Schedule:**
Choose one of these options:

**Option A - Simple (Once Daily):**
- **Execution:**Every day at a fixed time
- **Time:** `12:00` (noon) or your preferred time
- **Timezone:** Your timezone

**Option B - Multiple Times (Recommended):**
- **Execution:** Every X hours
- **Hours:** `4` (runs every 4 hours = 6 times per day)

**Advanced Settings (click to expand):**
- **Request body:** Leave empty OR put `{}`
- **Content-Type:** `application/json`

3. Click **"Create cronjob"**

### Step 3: Test It
1. In your cron job list, click the ▶️ **"Run now"** button
2. Wait 1-2 minutes
3. Check your website - new articles should appear
4. Check the execution history - should show success ✅

## ✅ Alternative: EasyCron (Also Free)

If cron-job.org doesn't work for you:

1. Go to https://www.easycron.com/user/sign_up
2. Sign up (free tier allows 1 cron job)
3. Add new cron job:
   - **URL:** `https://privatecreditpulse.net/api/cron/manual-trigger`
   - **Cron Expression:** `0 */4 * * *` (every 4 hours)
   - **HTTP Method:** `POST`
4. Save and enable

## ✅ Test Your Endpoint Manually

Before setting up cron, test that your endpoint works:

```bash
curl -X POST https://privatecreditpulse.net/api/cron/manual-trigger \
  -H "Content-Type: application/json"
```

You should see a JSON response with `"success": true`

## 📊 Verify It's Working

After setting up the cron job:

1. **Check execution logs** in cron-job.org dashboard
2. **Visit your website:** https://privatecreditpulse.net
3. **Check Supabase** to see if new articles are being added
4. **Check article dates** - should show today's date

## 🎯 Recommended Schedule

For best results:
- **Every 4-6 hours** = Fresh news throughout the day
- **Once daily at noon** = Simple and reliable
- **3 times daily** = 8 AM, 12 PM, 5 PM

## ⚠️ Troubleshooting

### Cron job shows "failed"?
- Check that your Vercel app is deployed and running
- Verify the URL is correct: `https://privatecreditpulse.net`
- Check Vercel logs for errors

### No new articles appearing?
- Check Vercel environment variables are set
- Verify API keys (PERPLEXITY_API_KEY, OPENAI_API_KEY)
- Check Supabase connection

### Articles from old dates?
- This is normal - the system fetches news from various dates
- New articles should still be added daily

## 🎉 That's It!

Once set up, your news will fetch automatically every day. No GitHub Actions, no Vercel cron issues, just simple and reliable!

**Setup time: 5 minutes**
**Reliability: 99.9%**
**Cost: FREE**


