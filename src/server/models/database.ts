import sqlite3 from 'sqlite3';
import { config } from '../utils/config';
import path from 'path';
import fs from 'fs';

export class Database {
  private db: sqlite3.Database | null = null;

  constructor() {
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      // Ensure data directory exists
      const dbDir = path.dirname(config.databasePath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Initialize SQLite database
      this.db = new sqlite3.Database(config.databasePath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          throw err;
        }
        console.log('Connected to SQLite database');
      });

      // Create tables
      await this.createTables();
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const tables = [
      // Recipes table
      `CREATE TABLE IF NOT EXISTS recipes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        ingredients TEXT NOT NULL, -- JSON array
        instructions TEXT NOT NULL, -- JSON array
        serving_size INTEGER NOT NULL,
        cooking_time INTEGER NOT NULL,
        difficulty INTEGER NOT NULL,
        cuisine TEXT,
        tags TEXT, -- JSON array
        dietary_compatibility TEXT, -- JSON array
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        popularity INTEGER DEFAULT 0
      )`,

      // Recipe cache table
      `CREATE TABLE IF NOT EXISTS recipe_cache (
        id TEXT PRIMARY KEY,
        query_hash TEXT UNIQUE NOT NULL,
        recipe_data TEXT NOT NULL, -- JSON
        hit_count INTEGER DEFAULT 1,
        last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Nutritional information table
      `CREATE TABLE IF NOT EXISTS recipe_nutrition (
        id TEXT PRIMARY KEY,
        recipe_id TEXT NOT NULL,
        serving_size INTEGER NOT NULL,
        calories INTEGER,
        protein REAL,
        carbohydrates REAL,
        fat REAL,
        fiber REAL,
        sugar REAL,
        sodium REAL,
        vitamins TEXT, -- JSON object
        minerals TEXT, -- JSON object
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
      )`,

      // Dietary profiles table
      `CREATE TABLE IF NOT EXISTS dietary_profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT UNIQUE NOT NULL,
        allergies TEXT, -- JSON array
        dietary_preferences TEXT, -- JSON array
        health_conditions TEXT, -- JSON array
        nutritional_goals TEXT, -- JSON object
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Ingredient substitutions cache
      `CREATE TABLE IF NOT EXISTS ingredient_substitutions (
        id TEXT PRIMARY KEY,
        original_ingredient TEXT NOT NULL,
        substitute_ingredient TEXT NOT NULL,
        dietary_restriction TEXT NOT NULL,
        substitution_ratio REAL NOT NULL,
        flavor_impact TEXT,
        texture_impact TEXT,
        ai_explanation TEXT,
        confidence_score REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Recipe ratings and reviews
      `CREATE TABLE IF NOT EXISTS recipe_reviews (
        id TEXT PRIMARY KEY,
        recipe_id TEXT NOT NULL,
        user_id TEXT,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        review_text TEXT,
        difficulty_rating INTEGER CHECK (difficulty_rating >= 1 AND difficulty_rating <= 5),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
      )`
    ];

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_recipes_cuisine ON recipes(cuisine)',
      'CREATE INDEX IF NOT EXISTS idx_recipes_difficulty ON recipes(difficulty)',
      'CREATE INDEX IF NOT EXISTS idx_recipes_popularity ON recipes(popularity DESC)',
      'CREATE INDEX IF NOT EXISTS idx_recipe_cache_query_hash ON recipe_cache(query_hash)',
      'CREATE INDEX IF NOT EXISTS idx_recipe_cache_last_accessed ON recipe_cache(last_accessed DESC)',
      'CREATE INDEX IF NOT EXISTS idx_nutrition_recipe_id ON recipe_nutrition(recipe_id)',
      'CREATE INDEX IF NOT EXISTS idx_substitutions_original ON ingredient_substitutions(original_ingredient)',
      'CREATE INDEX IF NOT EXISTS idx_substitutions_dietary ON ingredient_substitutions(dietary_restriction)',
      'CREATE INDEX IF NOT EXISTS idx_reviews_recipe_id ON recipe_reviews(recipe_id)',
      'CREATE INDEX IF NOT EXISTS idx_reviews_rating ON recipe_reviews(rating)'
    ];

    try {
      // Execute table creation
      for (const table of tables) {
        await this.run(table);
      }

      // Execute index creation
      for (const index of indexes) {
        await this.run(index);
      }

      console.log('Database tables and indexes created successfully');
    } catch (error) {
      console.error('Error creating tables:', error);
      throw error;
    }
  }

  // Promisified database operations
  public run(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      });
    });
  }

  public get(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  public all(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  public close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }

      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Database connection closed');
          resolve();
        }
      });
    });
  }

  // Health check
  public async healthCheck(): Promise<boolean> {
    try {
      await this.get('SELECT 1');
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  // Clean up old cache entries
  public async cleanupCache(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - config.cacheTtlHours);

    try {
      await this.run(
        'DELETE FROM recipe_cache WHERE last_accessed < ?',
        [cutoffDate.toISOString()]
      );

      // Keep only the most popular entries if we exceed max entries
      const countResult = await this.get('SELECT COUNT(*) as count FROM recipe_cache');
      if (countResult.count > config.cacheMaxEntries) {
        const excessCount = countResult.count - config.cacheMaxEntries;
        await this.run(`
          DELETE FROM recipe_cache 
          WHERE id IN (
            SELECT id FROM recipe_cache 
            ORDER BY hit_count ASC, last_accessed ASC 
            LIMIT ?
          )
        `, [excessCount]);
      }

      console.log('Cache cleanup completed');
    } catch (error) {
      console.error('Cache cleanup failed:', error);
    }
  }
}

// Singleton instance
export const database = new Database();