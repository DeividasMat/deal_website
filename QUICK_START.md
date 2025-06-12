# 🚀 Quick Start: Get Deals Showing in 5 Minutes

## The Issue You're Seeing

If you're not seeing any deals, it's because the API keys aren't configured yet. Here's how to fix it:

## ⚡ Fast Fix (5 Minutes)

### 1. Get Your API Keys (2 minutes)

#### Perplexity API Key
1. Go to https://docs.perplexity.ai/
2. Sign up/login
3. Click "API" → "Create New Key"
4. Copy the key (starts with `pplx-`)

#### OpenAI API Key  
1. Go to https://platform.openai.com/
2. Sign up/login → API Keys
3. "Create new secret key"
4. Copy the key (starts with `sk-`)

### 2. Add Keys to Vercel (2 minutes)

1. Go to your Vercel dashboard
2. Find your `deal-website` project
3. Go to **Settings** → **Environment Variables**
4. Add these two variables:

```
PERPLEXITY_API_KEY = pplx-your-key-here
OPENAI_API_KEY = sk-your-key-here
```

### 3. Redeploy (1 minute)

Click **"Redeploy"** in Vercel or push any change to trigger deployment.

## ✅ Test It Works

1. Visit your app URL
2. You should see no more yellow warning at the top
3. Click **"🚀 Find Private Credit Deals"** 
4. Wait 30-60 seconds for results

## 🎯 What You'll See

### On Business Days (Mon-Fri):
- **3-15 deals** from sources like Bloomberg, Reuters, PEI News
- Fund launches, acquisitions, lending deals
- Professional AI-generated summaries

### On Weekends:
- **0-3 deals** (normal - limited financial news)
- Try searching for the previous Friday

## 💡 Pro Tips

- **Best results**: Search Tuesday-Thursday (peak deal activity)
- **Yesterday's date** is pre-selected for immediate searching
- **Automatic daily updates** at 12 PM EST once configured
- **Historical browsing** available via date selector

## 🔧 Still Not Working?

### Check Your Deployment URL:
Visit: `https://your-app.vercel.app/api/health`

**Should show:**
```json
{
  "status": "healthy", 
  "services": {
    "perplexity": "configured",
    "openai": "configured"
  }
}
```

### Common Issues:
- **Yellow warning still showing**: API keys not added correctly
- **"Configure API Keys First" button**: Redeploy after adding keys  
- **No deals on weekend**: Normal behavior, try a weekday
- **Search timeout**: Wait 60 seconds, heavy AI processing

## 📊 What the Search Does

Your enhanced system now:
1. **Searches 3 different strategies** for maximum coverage
2. **Targets specific sources**: Bloomberg, Reuters, PEI News, Preqin
3. **Finds multiple deal types**: Fund launches, acquisitions, lending, refinancing
4. **AI summarizes everything** into readable format

## 🎉 That's It!

Once configured, you'll have:
- ✅ Automatic daily deal discovery
- ✅ Professional summaries 
- ✅ Multiple source coverage
- ✅ Historical deal browsing
- ✅ No manual work required

**Repository**: https://github.com/DeividasMat/deal_website.git

---

*Total setup time: ~5 minutes. Once done, you'll get comprehensive private credit market intelligence daily!* 