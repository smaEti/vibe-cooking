// Core Recipe Types
export interface Recipe {
  id: string;
  name: string;
  description: string;
  ingredients: Ingredient[];
  instructions: string[];
  servingSize: number;
  cookingTime: number;
  difficulty: number; // 1-5 scale
  cuisine: string;
  tags: string[];
  nutritionalInfo?: NutritionalInfo;
  dietaryCompatibility: DietaryRestriction[];
  createdAt: Date;
  updatedAt: Date;
  popularity: number;
}

export interface Ingredient {
  name: string;
  amount: number;
  unit: string;
  notes?: string;
  substitutions?: IngredientSubstitution[];
}

export interface IngredientSubstitution {
  substitute: string;
  ratio: number;
  reason: string;
  dietaryRestriction: DietaryRestriction;
  confidenceScore: number;
}

// Nutritional Information
export interface NutritionalInfo {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  vitamins: Record<string, number>;
  minerals: Record<string, number>;
  servingSize: number;
}

// Dietary Restrictions and Preferences
export enum DietaryRestriction {
  // Allergies
  NUTS = 'nuts',
  DAIRY = 'dairy',
  GLUTEN = 'gluten',
  SHELLFISH = 'shellfish',
  EGGS = 'eggs',
  SOY = 'soy',
  FISH = 'fish',
  
  // Dietary Preferences
  VEGETARIAN = 'vegetarian',
  VEGAN = 'vegan',
  PESCATARIAN = 'pescatarian',
  KETO = 'keto',
  PALEO = 'paleo',
  MEDITERRANEAN = 'mediterranean',
  
  // Health Conditions
  DIABETIC_FRIENDLY = 'diabetic_friendly',
  LOW_SODIUM = 'low_sodium',
  HEART_HEALTHY = 'heart_healthy',
  LOW_CHOLESTEROL = 'low_cholesterol',
  
  // Cultural/Religious
  HALAL = 'halal',
  KOSHER = 'kosher',
  HINDU_VEGETARIAN = 'hindu_vegetarian'
}

export interface DietaryProfile {
  id: string;
  userId: string;
  allergies: DietaryRestriction[];
  dietaryPreferences: DietaryRestriction[];
  healthConditions: DietaryRestriction[];
  nutritionalGoals: NutritionalGoals;
  createdAt: Date;
  updatedAt: Date;
}

export interface NutritionalGoals {
  dailyCalories?: number;
  proteinPercentage?: number;
  carbPercentage?: number;
  fatPercentage?: number;
  fiberGoal?: number;
  sodiumLimit?: number;
  goal: 'weight_loss' | 'weight_gain' | 'maintenance' | 'muscle_gain';
}

// AI Service Types
export interface AIRecipeRequest {
  type: 'ingredients' | 'food_name';
  input: string[] | string;
  dietaryRestrictions: DietaryRestriction[];
  servingSize: number;
  cuisinePreference?: string;
  difficultyPreference?: number;
}

export interface AIRecipeResponse {
  recipes: RecipeSuggestion[];
  confidence: number;
  processingTime: number;
}

export interface RecipeSuggestion {
  name: string;
  description: string;
  ingredients: Ingredient[];
  instructions: string[];
  cookingTime: number;
  difficulty: number;
  cuisine: string;
  tags: string[];
  nutritionalHighlights: string[];
  dietaryCompatibility: DietaryRestriction[];
  confidence: number;
}

export interface RecipeVariation {
  name: string;
  description: string;
  variation: string;
  culturalContext?: string;
  ingredients: Ingredient[];
  instructions: string[];
  cookingTime: number;
  difficulty: number;
  uniqueFeatures: string[];
}

// API Request/Response Types
export interface CreateRecipeRequest {
  ingredients?: string[];
  foodName?: string;
  dietaryRestrictions: DietaryRestriction[];
  servingSize: number;
  cuisinePreference?: string;
}

export interface ScaleRecipeRequest {
  recipeId: string;
  newServingSize: number;
}

export interface SubstituteIngredientRequest {
  ingredient: string;
  dietaryRestrictions: DietaryRestriction[];
  recipeContext: string;
}

export interface AnalyzeDietaryRequest {
  recipe: Recipe;
  dietaryRestrictions: DietaryRestriction[];
}

export interface UserPreferencesRequest {
  allergies: DietaryRestriction[];
  dietaryPreferences: DietaryRestriction[];
  healthConditions: DietaryRestriction[];
  nutritionalGoals: NutritionalGoals;
}

// Database Models
export interface RecipeCache {
  id: string;
  queryHash: string;
  recipeData: Recipe;
  hitCount: number;
  lastAccessed: Date;
  createdAt: Date;
}

export interface IngredientSubstitutionCache {
  id: string;
  originalIngredient: string;
  substituteIngredient: string;
  dietaryRestriction: DietaryRestriction;
  substitutionRatio: number;
  flavorImpact: string;
  textureImpact: string;
  aiExplanation: string;
  confidenceScore: number;
  createdAt: Date;
}

// Configuration Types
export interface AIConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  databasePath: string;
  cacheTtlHours: number;
  cacheMaxEntries: number;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  corsOrigin: string;
  ai: AIConfig;
}

// Error Types
export class RecipeError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'RecipeError';
  }
}

export class AIServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}