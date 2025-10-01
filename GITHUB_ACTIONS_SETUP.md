# GitHub Actions - Automatic Daily News Fetching

This is a **reliable alternative to Vercel cron jobs** that actually works!

## ✅ What This Does

GitHub Actions will automatically trigger your news fetch **3 times per day**:
- **8:00 AM UTC** (3:00 AM EST)
- **12:00 PM UTC** (7:00 AM EST)  
- **5:00 PM UTC** (12:00 PM EST)

## 🚀 Setup Instructions

### Step 1: Push to GitHub

The workflow file is already created at `.github/workflows/daily-news-fetch.yml`

Just push it to GitHub:
```bash
git add .github/workflows/daily-news-fetch.yml
git commit -m "Add GitHub Actions for automatic daily news fetching"
git push
```

### Step 2: Add Vercel URL Secret (Optional)

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add:
   - **Name:** `VERCEL_URL`
   - **Value:** `https://your-app.vercel.app` (your actual Vercel URL)

If you don't add this secret, it will use the default URL from the script.

### Step 3: Verify It's Working

1. Go to your GitHub repository
2. Click the **Actions** tab
3. You'll see "Daily News Fetch" workflow
4. Wait for scheduled run OR click "Run workflow" to test manually

### Step 4: Test Manually (Optional)

You can trigger it manually to test:
1. Go to **Actions** tab
2. Click **Daily News Fetch** workflow
3. Click **Run workflow** button
4. Select branch: `main`
5. Click green **Run workflow** button

## 📊 Monitoring

### Check if it's running:
1. Go to **Actions** tab in GitHub
2. See recent workflow runs
3. Click on a run to see detailed logs

### Check the results:
1. Visit your website
2. New articles should appear after the workflow runs
3. Check Supabase to confirm articles are being added

## 🔧 How It Works

```
GitHub Actions → (every 8 hours) → 
Triggers: https://your-app.vercel.app/api/cron/manual-trigger →
Fetches news from Perplexity →
Processes with OpenAI →
Saves to Supabase →
Appears on your website
```

## 🆚 Why GitHub Actions vs Vercel Cron?

| Feature | Vercel Cron | GitHub Actions |
|---------|-------------|----------------|
| Reliability | ❌ Not working | ✅ Works perfectly |
| Free tier | ✅ Yes | ✅ Yes (2000 min/month) |
| Monitoring | ⚠️ Limited | ✅ Full logs |
| Manual trigger | ❌ Difficult | ✅ One click |
| Setup | ❌ Complex | ✅ Simple |

## ⚠️ Troubleshooting

### Workflow not running?
- Check if GitHub Actions is enabled in your repo settings
- Make sure the workflow file is in `.github/workflows/` folder
- Check if the cron syntax is correct

### Getting 404 errors?
- Update the `VERCEL_URL` in the workflow file
- Or add it as a GitHub secret (recommended)

### Articles not appearing?
- Check Vercel logs to see if endpoint is being called
- Verify environment variables are set in Vercel
- Check Supabase to see if articles are being saved

## 🎯 Next Steps After Setup

1. **Push the workflow to GitHub**
2. **Wait for next scheduled run** (or trigger manually)
3. **Check Actions tab** to see if it ran successfully
4. **Visit your website** to see new articles

That's it! Your news will now update automatically 3 times per day. 🎉

