#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Create a simple TypeScript runner for the fix script
const fixScript = `
import { getDatabase } from '../lib/database';
import { OpenAIService } from '../lib/openai';
import { DateValidator } from '../lib/date-validator';

class ArticleDateFixer {
  constructor() {
    this.db = getDatabase();
    this.openai = new OpenAIService();
    this.dateValidator = new DateValidator();
    this.fixed = 0;
    this.failed = 0;
    this.skipped = 0;
    this.processed = 0;
  }

  async run() {
    console.log('🔍 Starting comprehensive database article date fixing...');
    
    try {
      // Get all articles from database
      const allArticles = await this.db.getAllDeals();
      console.log(\`📊 Found \${allArticles.length} total articles in database\`);
      
      // Filter articles that need date fixing
      const articlesToFix = allArticles.filter(article => this.needsDateFix(article));
      console.log(\`⚠️  Found \${articlesToFix.length} articles that need date fixing\`);
      
      if (articlesToFix.length === 0) {
        console.log('✅ All articles already have correct dates!');
        return;
      }
      
      // Process articles in batches
      const batchSize = 10;
      for (let i = 0; i < articlesToFix.length; i += batchSize) {
        const batch = articlesToFix.slice(i, i + batchSize);
        console.log(\`\\n🔄 Processing batch \${Math.floor(i/batchSize) + 1}/\${Math.ceil(articlesToFix.length/batchSize)} (\${batch.length} articles)\`);
        
        await this.processBatch(batch);
        
        // Add delay to avoid overwhelming APIs
        if (i + batchSize < articlesToFix.length) {
          console.log('⏳ Waiting 2 seconds before next batch...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      console.log('\\n📊 Final Results:');
      console.log(\`✅ Fixed: \${this.fixed} articles\`);
      console.log(\`❌ Failed: \${this.failed} articles\`);
      console.log(\`⏭️  Skipped: \${this.skipped} articles\`);
      console.log(\`📈 Total processed: \${this.processed} articles\`);
      
    } catch (error) {
      console.error('❌ Error during article date fixing:', error);
      throw error;
    }
  }

  needsDateFix(article) {
    const articleDate = new Date(article.date);
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    // Check if date is invalid, in the future, or too old
    if (isNaN(articleDate.getTime())) {
      return true; // Invalid date
    }
    
    if (articleDate > today) {
      return true; // Future date
    }
    
    if (articleDate < thirtyDaysAgo) {
      return true; // Too old (more than 30 days ago)
    }
    
    return false;
  }

  async processBatch(articles) {
    const promises = articles.map(article => this.processArticle(article));
    await Promise.all(promises);
  }

  async processArticle(article) {
    this.processed++;
    
    try {
      console.log(\`🔍 Processing: "\${article.title?.substring(0, 50)}..." (ID: \${article.id})\`);
      console.log(\`   Current date: \${article.date}\`);
      
      // Use the date validator to get the correct date
      const correctedDate = await this.dateValidator.validateArticleDate(
        article.title || '',
        article.summary || '',
        article.content || '',
        article.source_url,
        article.date
      );
      
      console.log(\`   Corrected date: \${correctedDate}\`);
      
      // Check if the date actually changed
      if (correctedDate === article.date) {
        console.log(\`   ⏭️  No change needed for article \${article.id}\`);
        this.skipped++;
        return;
      }
      
      // Update the article in the database
      await this.db.updateDealDate(article.id, correctedDate);
      console.log(\`   ✅ Updated article \${article.id} from \${article.date} to \${correctedDate}\`);
      this.fixed++;
      
    } catch (error) {
      console.error(\`   ❌ Failed to process article \${article.id}:\`, error.message);
      this.failed++;
    }
  }
}

// Run the script
async function main() {
  const fixer = new ArticleDateFixer();
  await fixer.run();
}

main().catch(console.error);
`;

// Write the TypeScript file
const fs = require('fs');
const tsFilePath = path.join(__dirname, 'temp-fix-dates.ts');

fs.writeFileSync(tsFilePath, fixScript);

// Run the TypeScript file using npx tsx
console.log('🚀 Running database article date fixing script...');

const child = spawn('npx', ['tsx', tsFilePath], {
  stdio: 'inherit',
  cwd: process.cwd()
});

child.on('close', (code) => {
  // Clean up the temp file
  try {
    fs.unlinkSync(tsFilePath);
  } catch (error) {
    // Ignore cleanup errors
  }
  
  if (code === 0) {
    console.log('✅ Article date fixing completed successfully!');
  } else {
    console.error('❌ Article date fixing failed with exit code:', code);
  }
  
  process.exit(code);
});

child.on('error', (error) => {
  console.error('❌ Error running script:', error);
  process.exit(1);
}); 