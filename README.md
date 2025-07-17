# Private Credit Deals Dashboard

A sophisticated web application that automatically fetches and summarizes private credit deal announcements using Perplexity AI and OpenAI, with daily automated updates.

## Features

- 🔍 **Automated Deal Discovery**: Uses Perplexity AI to search for private credit deal announcements
- 📝 **AI-Powered Summaries**: OpenAI generates concise, professional summaries of deals
- ⏰ **Daily Automation**: Automatically fetches deals every day at 12 PM EST
- 📅 **Historical Data**: Browse deals from previous days
- 🎨 **Modern UI**: Clean, responsive design built with Tailwind CSS
- 🗄️ **Persistent Storage**: SQLite database for reliable data storage

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **Database**: SQLite
- **AI Services**: Perplexity AI, OpenAI
- **Scheduling**: Node-cron
- **Styling**: Tailwind CSS

## Prerequisites

- Node.js 18+ installed
- Perplexity AI API key
- OpenAI API key

## Quick Setup

### 🚀 Ready to Deploy? 
**See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete Vercel deployment guide with API key setup!**

### 💻 Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```

3. **Visit the application**: `http://localhost:3000`

4. **Add API keys for full functionality**:
   ```bash
   # Create .env.local file
   echo "OPENAI_API_KEY=your_openai_key_here" > .env.local
   echo "PERPLEXITY_API_KEY=your_perplexity_key_here" >> .env.local
   ```

## Getting API Keys

### Perplexity AI
1. Visit [https://docs.perplexity.ai](https://docs.perplexity.ai)
2. Sign up for an account
3. Navigate to API settings
4. Generate a new API key

### OpenAI
1. Visit [https://platform.openai.com](https://platform.openai.com)
2. Sign up for an account
3. Go to API keys section
4. Create a new secret key

## Usage

### Automatic Daily Updates
- The application automatically fetches new deals every day at 12 PM EST
- No manual intervention required once deployed

### Manual Deal Fetching
1. Select a date from the dropdown
2. Click "Fetch Latest Deals" to manually trigger deal discovery
3. The system will search for deals and generate summaries

### Browsing Historical Data
- Use the date selector to view deals from previous days
- All historical data is preserved in the local database

## Database

The application uses SQLite for data storage with the following schema:

```sql
CREATE TABLE deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

- `GET /api/deals` - Get available dates
- `GET /api/deals?date=YYYY-MM-DD` - Get deals for specific date
- `POST /api/deals` - Manually fetch deals for a date

## Deployment

### Vercel (Recommended)
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Other Platforms
- Ensure Node.js 18+ support
- Set environment variables
- Configure file system access for SQLite database

## Customization

### Scheduling
Modify the cron schedule in `lib/scheduler.ts`:
```typescript
// Current: Every day at 12 PM EST
cron.schedule('0 12 * * *', async () => {
  // Change this pattern for different timing
});
```

### Search Parameters
Customize the search query in `lib/perplexity.ts` to focus on specific types of deals or markets.

### Styling
Modify `tailwind.config.js` and component styles to match your brand preferences.

## Troubleshooting

### Common Issues

1. **API Rate Limits**: 
   - Check your API usage limits
   - Consider implementing retry logic for production

2. **Database Lock Issues**:
   - Ensure only one instance is writing to the database
   - Consider using a more robust database for high-traffic deployments

3. **Scheduling Not Working**:
   - Verify the application stays running in production
   - Check logs for cron execution

### Logs
- Check browser console for frontend issues
- Check server logs for backend/API issues
- Database operations are logged to console

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review the API documentation for Perplexity and OpenAI
3. Open an issue on GitHub

---

**Note**: This application requires active API keys and internet connectivity to function properly. Ensure your API keys have sufficient credits for daily operations. 