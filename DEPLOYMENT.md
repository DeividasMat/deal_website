# 🚀 Deploy to Vercel - Complete Setup Guide

## Step 1: Get Your API Keys

### 🔍 Perplexity AI API Key
1. Go to [https://docs.perplexity.ai/](https://docs.perplexity.ai/)
2. Click "Get Started" or "Sign Up"
3. Create an account and verify your email
4. Navigate to **API** section in your dashboard
5. Click **"Create API Key"**
6. Copy your API key (starts with `pplx-`)

### 🤖 OpenAI API Key
1. Visit [https://platform.openai.com/](https://platform.openai.com/)
2. Sign up or log in to your account
3. Go to **API Keys** in the left sidebar
4. Click **"Create new secret key"**
5. Give it a name like "Private Credit Deals"
6. Copy your API key (starts with `sk-`)

⚠️ **Important**: Add some credits to your OpenAI account for the API to work!

## Step 2: Deploy to Vercel

### Option A: Deploy with Vercel CLI (Recommended)
1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy your project:**
   ```bash
   vercel
   ```

4. **Follow the prompts:**
   - Link to existing project? **No**
   - Project name: **deal-website** (or your preferred name)
   - In which directory? **./** (current directory)

### Option B: Deploy via GitHub + Vercel Dashboard
1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Private Credit Deals website"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/deal-website.git
   git push -u origin main
   ```

2. **Connect to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Click "Deploy"

## Step 3: Configure Environment Variables

In your Vercel dashboard:

1. Go to your project → **Settings** → **Environment Variables**
2. Add these variables:

| Variable Name | Value | Description |
|---------------|-------|-------------|
| `OPENAI_API_KEY` | `sk-your-openai-key-here` | Your OpenAI API key |
| `PERPLEXITY_API_KEY` | `pplx-your-perplexity-key-here` | Your Perplexity API key |
| `DATABASE_PATH` | `./tmp/database.sqlite` | Database file path |
| `NEXT_PUBLIC_BASE_URL` | `https://your-app.vercel.app` | Your deployed URL |

3. **Redeploy** your application after adding environment variables

## Step 4: Test Your Deployment

1. **Visit your live URL** (e.g., `https://deal-website-abc123.vercel.app`)
2. **Check health endpoint:** `https://your-app.vercel.app/api/health`
   - Should show both APIs as "configured"
3. **Test deal fetching:**
   - Click "Fetch Latest Deals" 
   - Should successfully fetch and summarize deals

## Step 5: Verify Daily Automation

✅ **Automatic Features:**
- Deals fetch automatically at **12 PM EST daily**
- No manual intervention needed
- Historical data is preserved
- Browse previous days using the date selector

## 🔧 Troubleshooting

### Common Issues:

1. **"API key missing" errors:**
   - Verify environment variables are set correctly
   - Redeploy after adding variables

2. **Database errors on Vercel:**
   - Vercel uses serverless functions, database resets between deployments
   - This is normal - historical data will accumulate over time

3. **Function timeout:**
   - Perplexity/OpenAI calls can take time
   - Function timeout is set to 60 seconds in `vercel.json`

4. **API rate limits:**
   - Monitor your API usage in OpenAI/Perplexity dashboards
   - Consider upgrading plans for higher limits

### Testing Locally:
```bash
# Create .env.local file
echo "OPENAI_API_KEY=your-key-here" > .env.local
echo "PERPLEXITY_API_KEY=your-key-here" >> .env.local

# Test locally
npm run dev
```

## 📊 Expected Costs

**Estimated monthly costs for daily operation:**
- **OpenAI**: ~$5-15/month (GPT-4 for summaries)
- **Perplexity**: ~$20/month (Pro plan for API access)
- **Vercel**: Free tier is sufficient

## 🎯 Next Steps

Once deployed:
1. **Bookmark your live URL**
2. **Check daily at 12 PM EST** for new deals
3. **Browse historical data** using date selector
4. **Monitor API usage** in your dashboards

## 🚨 Security Notes

- Never commit API keys to git
- Use Vercel's environment variables only
- Rotate keys periodically for security
- Monitor API usage for unexpected spikes

---

Your private credit deals website is now live and will automatically update daily! 🎉 