import { v4 as uuidv4 } from 'uuid';
import { database } from './database';
import { 
  Recipe, 
  Ingredient, 
  NutritionalInfo, 
  DietaryRestriction,
  RecipeCache,
  RecipeError 
} from '@/types';

export class RecipeModel {
  // Create a new recipe
  static async create(recipeData: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt' | 'popularity'>): Promise<Recipe> {
    const id = uuidv4();
    const now = new Date();
    
    const recipe: Recipe = {
      ...recipeData,
      id,
      createdAt: now,
      updatedAt: now,
      popularity: 0
    };

    try {
      await database.run(`
        INSERT INTO recipes (
          id, name, description, ingredients, instructions, serving_size,
          cooking_time, difficulty, cuisine, tags, dietary_compatibility,
          created_at, updated_at, popularity
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        recipe.id,
        recipe.name,
        recipe.description,
        JSON.stringify(recipe.ingredients),
        JSON.stringify(recipe.instructions),
        recipe.servingSize,
        recipe.cookingTime,
        recipe.difficulty,
        recipe.cuisine,
        JSON.stringify(recipe.tags),
        JSON.stringify(recipe.dietaryCompatibility),
        recipe.createdAt.toISOString(),
        recipe.updatedAt.toISOString(),
        recipe.popularity
      ]);

      return recipe;
    } catch (error) {
      throw new RecipeError('Failed to create recipe', 'CREATE_FAILED', 500);
    }
  }

  // Get recipe by ID
  static async findById(id: string): Promise<Recipe | null> {
    try {
      const row = await database.get('SELECT * FROM recipes WHERE id = ?', [id]);
      
      if (!row) return null;

      return this.mapRowToRecipe(row);
    } catch (error) {
      throw new RecipeError('Failed to fetch recipe', 'FETCH_FAILED', 500);
    }
  }

  // Search recipes by ingredients
  static async findByIngredients(ingredients: string[], dietaryRestrictions: DietaryRestriction[] = []): Promise<Recipe[]> {
    try {
      let query = 'SELECT * FROM recipes WHERE 1=1';
      const params: any[] = [];

      // Filter by dietary restrictions
      if (dietaryRestrictions.length > 0) {
        const restrictionPlaceholders = dietaryRestrictions.map(() => '?').join(',');
        query += ` AND dietary_compatibility LIKE '%' || ? || '%'`;
        params.push(JSON.stringify(dietaryRestrictions));
      }

      // Add ingredient matching (simplified - in production, you'd want more sophisticated matching)
      if (ingredients.length > 0) {
        const ingredientConditions = ingredients.map(() => 'ingredients LIKE ?').join(' OR ');
        query += ` AND (${ingredientConditions})`;
        ingredients.forEach(ingredient => {
          params.push(`%${ingredient.toLowerCase()}%`);
        });
      }

      query += ' ORDER BY popularity DESC, created_at DESC LIMIT 20';

      const rows = await database.all(query, params);
      return rows.map(row => this.mapRowToRecipe(row));
    } catch (error) {
      throw new RecipeError('Failed to search recipes by ingredients', 'SEARCH_FAILED', 500);
    }
  }

  // Search recipes by name/cuisine
  static async findByName(searchTerm: string, dietaryRestrictions: DietaryRestriction[] = []): Promise<Recipe[]> {
    try {
      let query = `
        SELECT * FROM recipes 
        WHERE (name LIKE ? OR description LIKE ? OR cuisine LIKE ?)
      `;
      const params = [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`];

      // Filter by dietary restrictions
      if (dietaryRestrictions.length > 0) {
        query += ` AND dietary_compatibility LIKE ?`;
        params.push(`%${JSON.stringify(dietaryRestrictions)}%`);
      }

      query += ' ORDER BY popularity DESC, created_at DESC LIMIT 20';

      const rows = await database.all(query, params);
      return rows.map(row => this.mapRowToRecipe(row));
    } catch (error) {
      throw new RecipeError('Failed to search recipes by name', 'SEARCH_FAILED', 500);
    }
  }

  // Update recipe
  static async update(id: string, updates: Partial<Recipe>): Promise<Recipe> {
    try {
      const existing = await this.findById(id);
      if (!existing) {
        throw new RecipeError('Recipe not found', 'NOT_FOUND', 404);
      }

      const updatedRecipe = {
        ...existing,
        ...updates,
        updatedAt: new Date()
      };

      await database.run(`
        UPDATE recipes SET
          name = ?, description = ?, ingredients = ?, instructions = ?,
          serving_size = ?, cooking_time = ?, difficulty = ?, cuisine = ?,
          tags = ?, dietary_compatibility = ?, updated_at = ?
        WHERE id = ?
      `, [
        updatedRecipe.name,
        updatedRecipe.description,
        JSON.stringify(updatedRecipe.ingredients),
        JSON.stringify(updatedRecipe.instructions),
        updatedRecipe.servingSize,
        updatedRecipe.cookingTime,
        updatedRecipe.difficulty,
        updatedRecipe.cuisine,
        JSON.stringify(updatedRecipe.tags),
        JSON.stringify(updatedRecipe.dietaryCompatibility),
        updatedRecipe.updatedAt.toISOString(),
        id
      ]);

      return updatedRecipe;
    } catch (error) {
      if (error instanceof RecipeError) throw error;
      throw new RecipeError('Failed to update recipe', 'UPDATE_FAILED', 500);
    }
  }

  // Delete recipe
  static async delete(id: string): Promise<void> {
    try {
      const result = await database.run('DELETE FROM recipes WHERE id = ?', [id]);
      
      if (result.changes === 0) {
        throw new RecipeError('Recipe not found', 'NOT_FOUND', 404);
      }
    } catch (error) {
      if (error instanceof RecipeError) throw error;
      throw new RecipeError('Failed to delete recipe', 'DELETE_FAILED', 500);
    }
  }

  // Increment popularity
  static async incrementPopularity(id: string): Promise<void> {
    try {
      await database.run(
        'UPDATE recipes SET popularity = popularity + 1 WHERE id = ?',
        [id]
      );
    } catch (error) {
      // Don't throw error for popularity updates - it's not critical
      console.error('Failed to increment recipe popularity:', error);
    }
  }

  // Get popular recipes
  static async getPopular(limit: number = 10, dietaryRestrictions: DietaryRestriction[] = []): Promise<Recipe[]> {
    try {
      let query = 'SELECT * FROM recipes WHERE 1=1';
      const params: any[] = [];

      if (dietaryRestrictions.length > 0) {
        query += ` AND dietary_compatibility LIKE ?`;
        params.push(`%${JSON.stringify(dietaryRestrictions)}%`);
      }

      query += ' ORDER BY popularity DESC, created_at DESC LIMIT ?';
      params.push(limit);

      const rows = await database.all(query, params);
      return rows.map(row => this.mapRowToRecipe(row));
    } catch (error) {
      throw new RecipeError('Failed to fetch popular recipes', 'FETCH_FAILED', 500);
    }
  }

  // Scale recipe ingredients
  static scaleIngredients(ingredients: Ingredient[], originalServings: number, newServings: number): Ingredient[] {
    const scaleFactor = newServings / originalServings;
    
    return ingredients.map(ingredient => ({
      ...ingredient,
      amount: Math.round((ingredient.amount * scaleFactor) * 100) / 100 // Round to 2 decimal places
    }));
  }

  // Check dietary compatibility
  static checkDietaryCompatibility(recipe: Recipe, restrictions: DietaryRestriction[]): boolean {
    return restrictions.every(restriction => 
      recipe.dietaryCompatibility.includes(restriction)
    );
  }

  // Helper method to map database row to Recipe object
  private static mapRowToRecipe(row: any): Recipe {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      ingredients: JSON.parse(row.ingredients),
      instructions: JSON.parse(row.instructions),
      servingSize: row.serving_size,
      cookingTime: row.cooking_time,
      difficulty: row.difficulty,
      cuisine: row.cuisine,
      tags: JSON.parse(row.tags),
      dietaryCompatibility: JSON.parse(row.dietary_compatibility),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      popularity: row.popularity,
      nutritionalInfo: undefined // Will be loaded separately if needed
    };
  }
}

// Recipe Cache Model
export class RecipeCacheModel {
  // Save recipe to cache
  static async save(queryHash: string, recipeData: Recipe): Promise<void> {
    try {
      const id = uuidv4();
      await database.run(`
        INSERT OR REPLACE INTO recipe_cache (
          id, query_hash, recipe_data, hit_count, last_accessed, created_at
        ) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [id, queryHash, JSON.stringify(recipeData)]);
    } catch (error) {
      console.error('Failed to save recipe to cache:', error);
      // Don't throw - caching failures shouldn't break the app
    }
  }

  // Get recipe from cache
  static async get(queryHash: string): Promise<Recipe | null> {
    try {
      const row = await database.get(
        'SELECT * FROM recipe_cache WHERE query_hash = ?',
        [queryHash]
      );

      if (!row) return null;

      // Update hit count and last accessed
      await database.run(`
        UPDATE recipe_cache 
        SET hit_count = hit_count + 1, last_accessed = CURRENT_TIMESTAMP 
        WHERE query_hash = ?
      `, [queryHash]);

      return JSON.parse(row.recipe_data);
    } catch (error) {
      console.error('Failed to get recipe from cache:', error);
      return null;
    }
  }

  // Generate cache key for query
  static generateCacheKey(type: string, input: any, restrictions: DietaryRestriction[]): string {
    const crypto = require('crypto');
    const data = JSON.stringify({ type, input, restrictions });
    return crypto.createHash('md5').update(data).digest('hex');
  }
}