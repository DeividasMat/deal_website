import sqlite3 from 'sqlite3';

export interface Deal {
  id?: number;
  date: string;
  title: string;
  summary: string;
  content: string;
  source: string;
  source_url?: string;
  category?: string;
  upvotes?: number;
  created_at?: string;
}

export interface Vote {
  id?: number;
  article_id: number;
  user_ip: string;
  created_at?: string;
}

class Database {
  private db: sqlite3.Database;
  private initialized: boolean = false;
  
  constructor() {
    const dbPath = process.env.DATABASE_PATH || './database.sqlite';
    this.db = new sqlite3.Database(dbPath);
    this.initialize();
  }

  private async initialize() {
    if (this.initialized) return;
    
    return new Promise<void>((resolve, reject) => {
      // Create deals table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS deals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          title TEXT NOT NULL,
          summary TEXT NOT NULL,
          content TEXT NOT NULL,
          source TEXT NOT NULL,
          source_url TEXT,
          category TEXT DEFAULT 'Market News',
          upvotes INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (error: Error) => {
        if (error) {
          console.error('Database deals table creation error:', error);
          reject(error);
          return;
        }

        // Create votes table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS votes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            article_id INTEGER NOT NULL,
            user_ip TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (article_id) REFERENCES deals (id),
            UNIQUE(article_id, user_ip)
          )
        `, (error: Error) => {
          if (error) {
            console.error('Database votes table creation error:', error);
            reject(error);
            return;
          }

          // Check and add missing columns to deals table
          this.db.all("PRAGMA table_info(deals)", (error: Error, rows: any[]) => {
            if (error) {
              console.error('Error checking table schema:', error);
              reject(error);
              return;
            }

            const columns = rows?.map((row: any) => row.name) || [];
            const missingColumns = [];

            if (!columns.includes('source_url')) missingColumns.push('source_url TEXT');
            if (!columns.includes('category')) missingColumns.push('category TEXT DEFAULT "Market News"');
            if (!columns.includes('upvotes')) missingColumns.push('upvotes INTEGER DEFAULT 0');

            if (missingColumns.length > 0) {
              let completed = 0;
              missingColumns.forEach((column) => {
                this.db.run(`ALTER TABLE deals ADD COLUMN ${column}`, (error: Error) => {
                  if (error && !error.message.includes('duplicate column')) {
                    console.error(`Error adding column ${column}:`, error);
                    reject(error);
                    return;
                  }
                  completed++;
                  if (completed === missingColumns.length) {
                    this.initialized = true;
                    console.log('Database initialized successfully with all columns');
                    resolve();
                  }
                });
              });
            } else {
              this.initialized = true;
              console.log('Database initialized successfully');
              resolve();
            }
          });
        });
      });
    });
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async saveDeal(deal: Omit<Deal, 'id' | 'created_at' | 'upvotes'>): Promise<number> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO deals (date, title, summary, content, source, source_url, category) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [deal.date, deal.title, deal.summary, deal.content, deal.source, deal.source_url || null, deal.category || 'Market News'],
        function(this: sqlite3.RunResult, error: Error) {
          if (error) reject(error);
          else resolve(this.lastID);
        }
      );
    });
  }

  async getDealsByDate(date: string): Promise<Deal[]> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM deals WHERE date = ? ORDER BY upvotes DESC, created_at DESC',
        [date],
        (error: Error, rows: Deal[]) => {
          if (error) reject(error);
          else resolve(rows || []);
        }
      );
    });
  }

  async getDealsByDateRange(startDate: string, endDate: string): Promise<Deal[]> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM deals WHERE date >= ? AND date <= ? ORDER BY upvotes DESC, created_at DESC',
        [startDate, endDate],
        (error: Error, rows: Deal[]) => {
          if (error) reject(error);
          else resolve(rows || []);
        }
      );
    });
  }

  async getDealsByCategory(category: string, limit: number = 15): Promise<Deal[]> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM deals WHERE category = ? ORDER BY upvotes DESC, created_at DESC LIMIT ?',
        [category, limit],
        (error: Error, rows: Deal[]) => {
          if (error) reject(error);
          else resolve(rows || []);
        }
      );
    });
  }

  async upvoteArticle(articleId: number, userIp: string): Promise<boolean> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      // Check if user already voted
      this.db.get(
        'SELECT id FROM votes WHERE article_id = ? AND user_ip = ?',
        [articleId, userIp],
        (error: Error, row: any) => {
          if (error) {
            reject(error);
            return;
          }
          
          if (row) {
            resolve(false); // Already voted
            return;
          }
          
          // Add vote
          this.db.run(
            'INSERT INTO votes (article_id, user_ip) VALUES (?, ?)',
            [articleId, userIp],
            (error: Error) => {
              if (error) {
                reject(error);
                return;
              }
              
              // Update upvote count
              this.db.run(
                'UPDATE deals SET upvotes = upvotes + 1 WHERE id = ?',
                [articleId],
                (error: Error) => {
                  if (error) reject(error);
                  else resolve(true);
                }
              );
            }
          );
        }
      );
    });
  }

  async getAvailableDates(): Promise<string[]> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT DISTINCT date FROM deals ORDER BY date DESC',
        (error: Error, rows: { date: string }[]) => {
          if (error) reject(error);
          else resolve((rows || []).map(r => r.date));
        }
      );
    });
  }

  async getAvailableCategories(): Promise<string[]> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT DISTINCT category FROM deals ORDER BY category',
        (error: Error, rows: { category: string }[]) => {
          if (error) reject(error);
          else resolve((rows || []).map(r => r.category));
        }
      );
    });
  }

  async getAllDeals(): Promise<Deal[]> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM deals ORDER BY upvotes DESC, date DESC, created_at DESC',
        (error: Error, rows: Deal[]) => {
          if (error) reject(error);
          else resolve(rows || []);
        }
      );
    });
  }

  async cleanupInvalidArticles(): Promise<number> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      this.db.run(
        `DELETE FROM deals WHERE 
         title LIKE '%News Update%' OR 
         title LIKE '%Update 1%' OR 
         title LIKE '%Update 2%' OR 
         title LIKE '%Update 3%' OR
         summary LIKE '%No summary available%' OR
         summary LIKE '%No content%' OR
         LENGTH(TRIM(summary)) < 30 OR
         LENGTH(TRIM(title)) < 10 OR
         (summary NOT LIKE '%$%' AND 
          summary NOT LIKE '%€%' AND 
          summary NOT LIKE '%£%' AND 
          summary NOT LIKE '%million%' AND 
          summary NOT LIKE '%billion%' AND 
          LOWER(summary) NOT LIKE '%facility%' AND 
          LOWER(summary) NOT LIKE '%credit%' AND 
          LOWER(summary) NOT LIKE '%fund%' AND 
          LOWER(summary) NOT LIKE '%investment%' AND 
          LOWER(summary) NOT LIKE '%financing%')`,
        function(this: sqlite3.RunResult, error: Error) {
          if (error) reject(error);
          else resolve(this.changes || 0);
        }
      );
    });
  }

  close() {
    this.db.close();
  }
}

let dbInstance: Database | null = null;

export function getDatabase(): Database {
  if (!dbInstance) {
    dbInstance = new Database();
  }
  return dbInstance;
} 