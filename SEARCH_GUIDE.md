# 🔍 Private Credit Deal Search Guide

## Enhanced Search Strategy

Your deal website now uses a **3-tier comprehensive search approach** to maximize private credit deal discovery.

## 🎯 Search Strategies

### Strategy 1: Comprehensive Source Search
```
Targets: PEI News, Preqin, Private Debt Investor, Bloomberg, Reuters
Focus: Fund launches, direct lending, refinancing, acquisitions
Keywords: "private credit", "direct lending", "private debt"
```

### Strategy 2: Focused Deal Search  
```
Targets: Financial press releases and announcements
Focus: Asset manager fundraising, middle market lending
Keywords: Alternative credit, specialty finance, sponsor-backed deals
```

### Strategy 3: Broader Market Context
```
Targets: Major financial publications
Focus: Private capital markets, institutional credit facilities
Keywords: Non-bank lending, structured credit, asset-based lending
```

## 📊 What Gets Found

### ✅ Typical Deal Types Discovered:
- **New Fund Launches**: Private credit fund raises and closings
- **Direct Lending**: Middle market loans and refinancing
- **Acquisitions**: Private credit firm M&A and partnerships  
- **Portfolio Investments**: Sponsor-backed transactions
- **Credit Facilities**: Large institutional lending deals
- **Strategic Announcements**: Fund manager updates and expansions

### 📈 Expected Results by Day Type:
- **Weekdays**: 5-15 relevant deals/announcements
- **Weekends**: 0-3 deals (limited news flow)
- **Holidays**: Minimal activity
- **Market Events**: Higher volume during earnings/conferences

## 🛠️ Troubleshooting

### 1. Check API Configuration
```bash
# Test your deployment
curl https://your-app.vercel.app/api/health

# Expected response:
{
  "status": "healthy",
  "services": {
    "perplexity": "configured",
    "openai": "configured"
  }
}
```

### 2. Debug Search Functionality
Visit: `https://your-app.vercel.app/api/debug?date=2025-06-11`

Or use the **"🔍 Debug Test"** button in your dashboard.

### 3. Common Issues & Solutions

#### ❌ "No deals found"
**Possible Causes:**
- Weekend/holiday (normal)
- Light market activity
- API rate limits
- Search timing issues

**Solutions:**
- Try different dates (business days)
- Check debug endpoint
- Verify API keys have sufficient credits

#### ❌ "PERPLEXITY_API_KEY not configured"
**Solution:**
1. Go to Vercel Dashboard → Your Project → Settings
2. Add environment variable: `PERPLEXITY_API_KEY=pplx-your-key`
3. Redeploy

#### ❌ "Search timeout" or 500 errors
**Possible Causes:**
- API rate limits
- Network issues
- Large search results

**Solutions:**
- Wait 1-2 minutes and retry
- Check API usage in Perplexity dashboard
- Verify Vercel function limits (60s timeout configured)

## 📋 Best Practices

### 1. **Optimal Search Times**
- **Best**: Tuesday-Thursday (peak deal flow)
- **Good**: Monday, Friday (moderate activity)  
- **Limited**: Saturday-Sunday, holidays

### 2. **API Usage Management**
- Monitor your Perplexity API credits
- Each search uses ~3 API calls (multi-strategy)
- Daily automation uses minimal credits
- Manual searches consume more credits

### 3. **Data Quality**
- Recent dates (1-7 days) have most complete data
- Financial news typically breaks during business hours
- Cross-reference with industry publications for accuracy

## 🔧 Advanced Configuration

### Customize Search Terms
Edit `lib/perplexity.ts` to modify search queries:
- Add specific company names you track
- Include additional keywords
- Target specific sectors or geographies

### Adjust Search Frequency
Edit `lib/scheduler.ts` to change automation:
```typescript
// Current: Daily at 12 PM EST  
cron.schedule('0 12 * * *', ...)

// Options:
// Every 2 hours: '0 */2 * * *'
// Business days only: '0 12 * * 1-5'
// Twice daily: '0 9,17 * * *'
```

## 📊 Expected API Costs

### Monthly Estimates (Daily Use):
- **Perplexity**: $15-25/month (Pro plan recommended)
- **OpenAI**: $5-15/month (GPT-4 for summaries)
- **Vercel**: Free (within limits)

### Cost Optimization:
- Use business days only scheduling
- Reduce manual searches
- Monitor API dashboard usage

## 🚀 Getting the Best Results

### 1. **Verify Configuration**
- Ensure both API keys are properly set
- Check Vercel environment variables
- Test debug endpoint regularly

### 2. **Optimal Usage Patterns**
- Run searches on business days
- Focus on Tuesday-Thursday for highest deal flow
- Use manual fetch for specific research needs

### 3. **Interpreting Results**
- Empty results on weekends = normal
- Rich results on weekdays = system working well
- Consistent errors = check API configuration

## 🆘 Support & Troubleshooting

### Quick Health Check:
1. Visit `/api/health` - should show APIs as "configured"
2. Try "🔍 Debug Test" button - should show search results
3. Check Vercel logs for any deployment issues

### Common Solutions:
1. **Redeploy** after adding environment variables
2. **Check API credits** in provider dashboards  
3. **Wait and retry** if hitting rate limits
4. **Test different dates** if no results found

---

Your enhanced search system is designed to find the maximum number of relevant private credit deals through multiple targeted approaches. The system is resilient with fallback strategies and comprehensive error handling. 