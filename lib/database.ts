import sqlite3 from 'sqlite3';

export interface Deal {
  id?: number;
  date: string;
  title: string;
  summary: string;
  content: string;
  source: string;
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
      this.db.run(`
        CREATE TABLE IF NOT EXISTS deals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          title TEXT NOT NULL,
          summary TEXT NOT NULL,
          content TEXT NOT NULL,
          source TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (error: Error) => {
        if (error) {
          console.error('Database initialization error:', error);
          reject(error);
        } else {
          this.initialized = true;
          console.log('Database initialized successfully');
          resolve();
        }
      });
    });
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async saveDeal(deal: Omit<Deal, 'id' | 'created_at'>): Promise<number> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO deals (date, title, summary, content, source) 
         VALUES (?, ?, ?, ?, ?)`,
        [deal.date, deal.title, deal.summary, deal.content, deal.source],
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
        'SELECT * FROM deals WHERE date = ? ORDER BY created_at DESC',
        [date],
        (error: Error, rows: Deal[]) => {
          if (error) reject(error);
          else resolve(rows || []);
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

  async getAllDeals(): Promise<Deal[]> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM deals ORDER BY date DESC, created_at DESC',
        (error: Error, rows: Deal[]) => {
          if (error) reject(error);
          else resolve(rows || []);
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