import { aiService } from './aiService';
import { RecipeModel, RecipeCacheModel } from '../models/Recipe';
import { DietaryProfileModel, NutritionModel, IngredientSubstitutionModel } from '../models/DietaryProfile';
import { 
  Recipe, 
  RecipeSuggestion, 
  RecipeVariation,
  DietaryRestriction,
  CreateRecipeRequest,
  ScaleRecipeRequest,
  SubstituteIngredientRequest,
  AnalyzeDietaryRequest,
  NutritionalInfo,
  IngredientSubstitution,
  RecipeError 
} from '../../types';

export class RecipeService {
  // Generate recipes by ingredients with caching
  async getRecipesByIngredients(
    ingredients: string[],
    dietaryRestrictions: DietaryRestriction[] = [],
    servingSize: number = 4,
    cuisinePreference?: string,
    userId?: string
  ): Promise<RecipeSuggestion[]> {
    try {
      // Add user's dietary restrictions if userId provided
      if (userId) {
        const userRestrictions = await DietaryProfileModel.getAllRestrictions(userId);
        dietaryRestrictions = [...new Set([...dietaryRestrictions, ...userRestrictions])];
      }

      // Check cache first
      const cacheKey = RecipeCacheModel.generateCacheKey(
        'ingredients',
        { ingredients, cuisinePreference, servingSize },
        dietaryRestrictions
      );

      const cachedResult = await RecipeCacheModel.get(cacheKey);
      if (cachedResult) {
        return [this.convertRecipeToSuggestion(cachedResult)];
      }

      // Generate new recipes using AI
      const suggestions = await aiService.generateRecipesByIngredients(
        ingredients,
        dietaryRestrictions,
        servingSize,
        cuisinePreference
      );  
      console.log(suggestions)

      // Cache the results
      for (const suggestion of suggestions) {
        const recipe = await this.convertSuggestionToRecipe(suggestion);
        await RecipeCacheModel.save(cacheKey, recipe);
      }

      return suggestions;
    } catch (error) {
      throw new RecipeError('Failed to get recipes by ingredients', 'SERVICE_ERROR', 500);
    }
  }

  // Generate recipe variations by food name
  async getRecipeVariationsByName(
    foodName: string,
    dietaryRestrictions: DietaryRestriction[] = [],
    servingSize: number = 4,
    userId?: string
  ): Promise<RecipeVariation[]> {
    try {
      // Add user's dietary restrictions if userId provided
      if (userId) {
        const userRestrictions = await DietaryProfileModel.getAllRestrictions(userId);
        dietaryRestrictions = [...new Set([...dietaryRestrictions, ...userRestrictions])];
      }

      // Check cache first
      const cacheKey = RecipeCacheModel.generateCacheKey(
        'foodName',
        { foodName, servingSize },
        dietaryRestrictions
      );

      const cachedResult = await RecipeCacheModel.get(cacheKey);
      if (cachedResult) {
        // Convert cached recipe to variations format
        return [this.convertRecipeToVariation(cachedResult)];
      }

      // Generate new variations using AI
      const variations = await aiService.generateRecipeVariations(
        foodName,
        dietaryRestrictions,
        servingSize
      );

      // Cache the results
      for (const variation of variations) {
        const recipe = await this.convertVariationToRecipe(variation);
        await RecipeCacheModel.save(cacheKey, recipe);
      }

      return variations;
    } catch (error) {
      throw new RecipeError('Failed to get recipe variations', 'SERVICE_ERROR', 500);
    }
  }

  // Create detailed recipe with AI-generated instructions and nutrition
  async createDetailedRecipe(
    suggestion: RecipeSuggestion,
    userId?: string
  ): Promise<Recipe> {
    try {
      // Generate detailed instructions
      const instructionData = await aiService.generateRecipeInstructions(
        suggestion.name,
        suggestion.ingredients.map(i => i.name),
        suggestion.dietaryCompatibility,
        suggestion.ingredients.length > 0 ? suggestion.ingredients[0].amount : 4
      );

      // Generate nutritional information
      const nutritionalInfo = await aiService.generateNutritionalInfo(
        suggestion.name,
        suggestion.ingredients.map(i => i.name),
        suggestion.ingredients.length > 0 ? suggestion.ingredients[0].amount : 4
      );

      // Create recipe object
      const recipe: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt' | 'popularity'> = {
        name: suggestion.name,
        description: suggestion.description,
        ingredients: suggestion.ingredients,
        instructions: instructionData.instructions,
        servingSize: suggestion.ingredients.length > 0 ? suggestion.ingredients[0].amount : 4,
        cookingTime: instructionData.cookingTime,
        difficulty: instructionData.difficulty,
        cuisine: suggestion.cuisine,
        tags: suggestion.tags,
        dietaryCompatibility: suggestion.dietaryCompatibility,
        nutritionalInfo
      };

      // Save recipe to database
      const savedRecipe = await RecipeModel.create(recipe);

      // Save nutritional information separately
      await NutritionModel.saveNutrition(
        savedRecipe.id,
        savedRecipe.servingSize,
        nutritionalInfo
      );

      return savedRecipe;
    } catch (error) {
      throw new RecipeError('Failed to create detailed recipe', 'SERVICE_ERROR', 500);
    }
  }

  // Scale recipe for different serving sizes
  async scaleRecipe(request: ScaleRecipeRequest): Promise<Recipe> {
    try {
      const recipe = await RecipeModel.findById(request.recipeId);
      if (!recipe) {
        throw new RecipeError('Recipe not found', 'NOT_FOUND', 404);
      }

      // Scale ingredients
      const scaledIngredients = RecipeModel.scaleIngredients(
        recipe.ingredients,
        recipe.servingSize,
        request.newServingSize
      );

      // Scale nutritional information if available
      let scaledNutrition: NutritionalInfo | undefined;
      if (recipe.nutritionalInfo) {
        scaledNutrition = NutritionModel.scaleNutrition(
          recipe.nutritionalInfo,
          recipe.servingSize,
          request.newServingSize
        );
      }

      // Create scaled recipe (don't save to DB, just return)
      const scaledRecipe: Recipe = {
        ...recipe,
        ingredients: scaledIngredients,
        servingSize: request.newServingSize,
        nutritionalInfo: scaledNutrition
      };

      // Increment popularity for the original recipe
      await RecipeModel.incrementPopularity(request.recipeId);

      return scaledRecipe;
    } catch (error) {
      if (error instanceof RecipeError) throw error;
      throw new RecipeError('Failed to scale recipe', 'SERVICE_ERROR', 500);
    }
  }

  // Get ingredient substitutions
  async getIngredientSubstitutions(request: SubstituteIngredientRequest): Promise<IngredientSubstitution[]> {
    try {
      // Check cache first
      const cachedSubstitutions = await IngredientSubstitutionModel.getSubstitutions(
        request.ingredient,
        request.dietaryRestrictions[0] // Use first restriction for cache lookup
      );

      if (cachedSubstitutions.length > 0) {
        return cachedSubstitutions;
      }

      // Generate new substitutions using AI
      const substitutions = await aiService.generateIngredientSubstitutions(
        request.ingredient,
        request.dietaryRestrictions,
        request.recipeContext
      );

      // Cache the substitutions
      for (const substitution of substitutions) {
        await IngredientSubstitutionModel.saveSubstitution(
          request.ingredient,
          substitution.substitute,
          substitution.dietaryRestriction,
          substitution.ratio,
          'unknown', // flavorImpact
          'unknown', // textureImpact
          substitution.reason,
          substitution.confidenceScore
        );
      }

      return substitutions;
    } catch (error) {
      throw new RecipeError('Failed to get ingredient substitutions', 'SERVICE_ERROR', 500);
    }
  }

  // Analyze dietary compatibility
  async analyzeDietaryCompatibility(request: AnalyzeDietaryRequest): Promise<{
    compatible: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    try {
      const analysis = await aiService.analyzeDietaryCompatibility(
        request.recipe.name,
        request.recipe.ingredients.map(i => i.name),
        request.recipe.instructions,
        request.dietaryRestrictions
      );

      return analysis;
    } catch (error) {
      throw new RecipeError('Failed to analyze dietary compatibility', 'SERVICE_ERROR', 500);
    }
  }

  // Get popular recipes with dietary filtering
  async getPopularRecipes(
    limit: number = 10,
    dietaryRestrictions: DietaryRestriction[] = [],
    userId?: string
  ): Promise<Recipe[]> {
    try {
      // Add user's dietary restrictions if userId provided
      if (userId) {
        const userRestrictions = await DietaryProfileModel.getAllRestrictions(userId);
        dietaryRestrictions = [...new Set([...dietaryRestrictions, ...userRestrictions])];
      }

      return await RecipeModel.getPopular(limit, dietaryRestrictions);
    } catch (error) {
      throw new RecipeError('Failed to get popular recipes', 'SERVICE_ERROR', 500);
    }
  }

  // Search recipes with dietary filtering
  async searchRecipes(
    query: string,
    dietaryRestrictions: DietaryRestriction[] = [],
    userId?: string
  ): Promise<Recipe[]> {
    try {
      // Add user's dietary restrictions if userId provided
      if (userId) {
        const userRestrictions = await DietaryProfileModel.getAllRestrictions(userId);
        dietaryRestrictions = [...new Set([...dietaryRestrictions, ...userRestrictions])];
      }

      return await RecipeModel.findByName(query, dietaryRestrictions);
    } catch (error) {
      throw new RecipeError('Failed to search recipes', 'SERVICE_ERROR', 500);
    }
  }

  // Get recipe with nutritional information
  async getRecipeWithNutrition(recipeId: string, servingSize?: number): Promise<Recipe | null> {
    try {
      const recipe = await RecipeModel.findById(recipeId);
      if (!recipe) return null;

      // Get nutritional information
      const nutrition = await NutritionModel.getNutrition(recipeId, servingSize);
      if (nutrition) {
        recipe.nutritionalInfo = nutrition;
      }

      // Increment popularity
      await RecipeModel.incrementPopularity(recipeId);

      return recipe;
    } catch (error) {
      throw new RecipeError('Failed to get recipe with nutrition', 'SERVICE_ERROR', 500);
    }
  }

  // Helper methods
  private convertRecipeToSuggestion(recipe: Recipe): RecipeSuggestion {
    return {
      name: recipe.name,
      description: recipe.description,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      cookingTime: recipe.cookingTime,
      difficulty: recipe.difficulty,
      cuisine: recipe.cuisine,
      tags: recipe.tags,
      nutritionalHighlights: [], // Default empty array
      dietaryCompatibility: recipe.dietaryCompatibility,
      confidence: 0.8 // Default confidence
    };
  }

  private async convertSuggestionToRecipe(suggestion: RecipeSuggestion): Promise<Recipe> {
    const now = new Date();
    return {
      id: '', // Will be set when saved
      name: suggestion.name,
      description: suggestion.description,
      ingredients: suggestion.ingredients,
      instructions: [], // Will be generated when needed
      servingSize: 4, // Default
      cookingTime: suggestion.cookingTime,
      difficulty: suggestion.difficulty,
      cuisine: suggestion.cuisine,
      tags: suggestion.tags,
      dietaryCompatibility: suggestion.dietaryCompatibility,
      createdAt: now,
      updatedAt: now,
      popularity: 0
    };
  }

  private convertRecipeToVariation(recipe: Recipe): RecipeVariation {
    return {
      name: recipe.name,
      description: recipe.description,
      variation: 'Cached version',
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      cookingTime: recipe.cookingTime,
      difficulty: recipe.difficulty,
      uniqueFeatures: recipe.tags
    };
  }

  private async convertVariationToRecipe(variation: RecipeVariation): Promise<Recipe> {
    const now = new Date();
    return {
      id: '', // Will be set when saved
      name: variation.name,
      description: variation.description,
      ingredients: variation.ingredients,
      instructions: variation.instructions,
      servingSize: 4, // Default
      cookingTime: variation.cookingTime,
      difficulty: variation.difficulty,
      cuisine: variation.culturalContext || 'International',
      tags: variation.uniqueFeatures || [],
      dietaryCompatibility: [], // Will be determined by AI analysis
      createdAt: now,
      updatedAt: now,
      popularity: 0
    };
  }
}

// Singleton instance
export const recipeService = new RecipeService();