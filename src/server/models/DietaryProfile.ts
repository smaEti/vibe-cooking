import { v4 as uuidv4 } from 'uuid';
import { database } from './database';
import {
  DietaryProfile,
  DietaryRestriction,
  NutritionalGoals,
  NutritionalInfo,
  RecipeError
} from '../../types';

export class DietaryProfileModel {
  // Create or update dietary profile
  static async createOrUpdate(userId: string, profileData: Omit<DietaryProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<DietaryProfile> {
    const existing = await this.findByUserId(userId);
    
    if (existing) {
      return this.update(existing.id, profileData);
    } else {
      return this.create(userId, profileData);
    }
  }

  // Create new dietary profile
  static async create(userId: string, profileData: Omit<DietaryProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<DietaryProfile> {
    const id = uuidv4();
    const now = new Date();
    
    const profile: DietaryProfile = {
      ...profileData,
      id,
      userId,
      createdAt: now,
      updatedAt: now
    };

    try {
      await database.run(`
        INSERT INTO dietary_profiles (
          id, user_id, allergies, dietary_preferences, health_conditions,
          nutritional_goals, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        profile.id,
        profile.userId,
        JSON.stringify(profile.allergies),
        JSON.stringify(profile.dietaryPreferences),
        JSON.stringify(profile.healthConditions),
        JSON.stringify(profile.nutritionalGoals),
        profile.createdAt.toISOString(),
        profile.updatedAt.toISOString()
      ]);

      return profile;
    } catch (error) {
      throw new RecipeError('Failed to create dietary profile', 'CREATE_FAILED', 500);
    }
  }

  // Get dietary profile by user ID
  static async findByUserId(userId: string): Promise<DietaryProfile | null> {
    try {
      const row = await database.get('SELECT * FROM dietary_profiles WHERE user_id = ?', [userId]);
      
      if (!row) return null;

      return this.mapRowToProfile(row);
    } catch (error) {
      throw new RecipeError('Failed to fetch dietary profile', 'FETCH_FAILED', 500);
    }
  }

  // Get dietary profile by ID
  static async findById(id: string): Promise<DietaryProfile | null> {
    try {
      const row = await database.get('SELECT * FROM dietary_profiles WHERE id = ?', [id]);
      
      if (!row) return null;

      return this.mapRowToProfile(row);
    } catch (error) {
      throw new RecipeError('Failed to fetch dietary profile', 'FETCH_FAILED', 500);
    }
  }

  // Update dietary profile
  static async update(id: string, updates: Partial<Omit<DietaryProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Promise<DietaryProfile> {
    try {
      const existing = await this.findById(id);
      if (!existing) {
        throw new RecipeError('Dietary profile not found', 'NOT_FOUND', 404);
      }

      const updatedProfile = {
        ...existing,
        ...updates,
        updatedAt: new Date()
      };

      await database.run(`
        UPDATE dietary_profiles SET
          allergies = ?, dietary_preferences = ?, health_conditions = ?,
          nutritional_goals = ?, updated_at = ?
        WHERE id = ?
      `, [
        JSON.stringify(updatedProfile.allergies),
        JSON.stringify(updatedProfile.dietaryPreferences),
        JSON.stringify(updatedProfile.healthConditions),
        JSON.stringify(updatedProfile.nutritionalGoals),
        updatedProfile.updatedAt.toISOString(),
        id
      ]);

      return updatedProfile;
    } catch (error) {
      if (error instanceof RecipeError) throw error;
      throw new RecipeError('Failed to update dietary profile', 'UPDATE_FAILED', 500);
    }
  }

  // Delete dietary profile
  static async delete(id: string): Promise<void> {
    try {
      const result = await database.run('DELETE FROM dietary_profiles WHERE id = ?', [id]);
      
      if (result.changes === 0) {
        throw new RecipeError('Dietary profile not found', 'NOT_FOUND', 404);
      }
    } catch (error) {
      if (error instanceof RecipeError) throw error;
      throw new RecipeError('Failed to delete dietary profile', 'DELETE_FAILED', 500);
    }
  }

  // Get all dietary restrictions for a user
  static async getAllRestrictions(userId: string): Promise<DietaryRestriction[]> {
    const profile = await this.findByUserId(userId);
    if (!profile) return [];

    return [
      ...profile.allergies,
      ...profile.dietaryPreferences,
      ...profile.healthConditions
    ];
  }

  // Check if user has specific restriction
  static async hasRestriction(userId: string, restriction: DietaryRestriction): Promise<boolean> {
    const restrictions = await this.getAllRestrictions(userId);
    return restrictions.includes(restriction);
  }

  // Get nutritional goals for user
  static async getNutritionalGoals(userId: string): Promise<NutritionalGoals | null> {
    const profile = await this.findByUserId(userId);
    return profile?.nutritionalGoals || null;
  }

  // Helper method to map database row to DietaryProfile object
  private static mapRowToProfile(row: any): DietaryProfile {
    return {
      id: row.id,
      userId: row.user_id,
      allergies: JSON.parse(row.allergies || '[]'),
      dietaryPreferences: JSON.parse(row.dietary_preferences || '[]'),
      healthConditions: JSON.parse(row.health_conditions || '[]'),
      nutritionalGoals: JSON.parse(row.nutritional_goals || '{}'),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}

// Nutrition Model
export class NutritionModel {
  // Save nutritional information for a recipe
  static async saveNutrition(recipeId: string, servingSize: number, nutrition: Omit<NutritionalInfo, 'servingSize'>): Promise<void> {
    const id = uuidv4();
    
    try {
      await database.run(`
        INSERT OR REPLACE INTO recipe_nutrition (
          id, recipe_id, serving_size, calories, protein, carbohydrates,
          fat, fiber, sugar, sodium, vitamins, minerals, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        id,
        recipeId,
        servingSize,
        nutrition.calories,
        nutrition.protein,
        nutrition.carbohydrates,
        nutrition.fat,
        nutrition.fiber,
        nutrition.sugar,
        nutrition.sodium,
        JSON.stringify(nutrition.vitamins),
        JSON.stringify(nutrition.minerals)
      ]);
    } catch (error) {
      throw new RecipeError('Failed to save nutritional information', 'SAVE_FAILED', 500);
    }
  }

  // Get nutritional information for a recipe
  static async getNutrition(recipeId: string, servingSize?: number): Promise<NutritionalInfo | null> {
    try {
      let query = 'SELECT * FROM recipe_nutrition WHERE recipe_id = ?';
      const params = [recipeId];

      if (servingSize) {
        query += ' AND serving_size = ?';
        params.push(servingSize.toString());
      }

      query += ' ORDER BY created_at DESC LIMIT 1';

      const row = await database.get(query, params);
      
      if (!row) return null;

      return {
        calories: row.calories,
        protein: row.protein,
        carbohydrates: row.carbohydrates,
        fat: row.fat,
        fiber: row.fiber,
        sugar: row.sugar,
        sodium: row.sodium,
        vitamins: JSON.parse(row.vitamins || '{}'),
        minerals: JSON.parse(row.minerals || '{}'),
        servingSize: row.serving_size
      };
    } catch (error) {
      throw new RecipeError('Failed to fetch nutritional information', 'FETCH_FAILED', 500);
    }
  }

  // Scale nutritional information for different serving sizes
  static scaleNutrition(nutrition: NutritionalInfo, originalServings: number, newServings: number): NutritionalInfo {
    const scaleFactor = newServings / originalServings;
    
    return {
      calories: Math.round(nutrition.calories * scaleFactor),
      protein: Math.round((nutrition.protein * scaleFactor) * 100) / 100,
      carbohydrates: Math.round((nutrition.carbohydrates * scaleFactor) * 100) / 100,
      fat: Math.round((nutrition.fat * scaleFactor) * 100) / 100,
      fiber: Math.round((nutrition.fiber * scaleFactor) * 100) / 100,
      sugar: Math.round((nutrition.sugar * scaleFactor) * 100) / 100,
      sodium: Math.round((nutrition.sodium * scaleFactor) * 100) / 100,
      vitamins: Object.fromEntries(
        Object.entries(nutrition.vitamins).map(([key, value]) => [
          key, 
          Math.round((value * scaleFactor) * 100) / 100
        ])
      ),
      minerals: Object.fromEntries(
        Object.entries(nutrition.minerals).map(([key, value]) => [
          key, 
          Math.round((value * scaleFactor) * 100) / 100
        ])
      ),
      servingSize: newServings
    };
  }
}

// Ingredient Substitution Model
export class IngredientSubstitutionModel {
  // Save ingredient substitution
  static async saveSubstitution(
    originalIngredient: string,
    substituteIngredient: string,
    dietaryRestriction: DietaryRestriction,
    substitutionRatio: number,
    flavorImpact: string,
    textureImpact: string,
    aiExplanation: string,
    confidenceScore: number
  ): Promise<void> {
    const id = uuidv4();
    
    try {
      await database.run(`
        INSERT INTO ingredient_substitutions (
          id, original_ingredient, substitute_ingredient, dietary_restriction,
          substitution_ratio, flavor_impact, texture_impact, ai_explanation,
          confidence_score, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        id,
        originalIngredient.toLowerCase(),
        substituteIngredient.toLowerCase(),
        dietaryRestriction,
        substitutionRatio,
        flavorImpact,
        textureImpact,
        aiExplanation,
        confidenceScore
      ]);
    } catch (error) {
      // Don't throw error for substitution caching - it's not critical
      console.error('Failed to save ingredient substitution:', error);
    }
  }

  // Get substitutions for an ingredient
  static async getSubstitutions(
    originalIngredient: string,
    dietaryRestriction?: DietaryRestriction
  ): Promise<any[]> {
    try {
      let query = 'SELECT * FROM ingredient_substitutions WHERE original_ingredient = ?';
      const params = [originalIngredient.toLowerCase()];

      if (dietaryRestriction) {
        query += ' AND dietary_restriction = ?';
        params.push(dietaryRestriction);
      }

      query += ' ORDER BY confidence_score DESC, created_at DESC';

      const rows = await database.all(query, params);
      return rows.map(row => ({
        substitute: row.substitute_ingredient,
        ratio: row.substitution_ratio,
        reason: row.ai_explanation,
        dietaryRestriction: row.dietary_restriction,
        confidenceScore: row.confidence_score,
        flavorImpact: row.flavor_impact,
        textureImpact: row.texture_impact
      }));
    } catch (error) {
      console.error('Failed to fetch ingredient substitutions:', error);
      return [];
    }
  }
}