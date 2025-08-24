import OpenAI from 'openai';
import axios from 'axios';
import { config, getAIHeaders, getAIRequestConfig } from '../utils/config';
import {
  AIRecipeRequest,
  AIRecipeResponse,
  RecipeSuggestion,
  RecipeVariation,
  DietaryRestriction,
  NutritionalInfo,
  IngredientSubstitution,
  AIServiceError
} from '../../types';

export class AIService {
  private openai: OpenAI | null = null;
  private isOpenAICompatible: boolean = false;

  constructor() {
    this.initializeClient();
  }

  private initializeClient(): void {
    try {
      // Check if the API URL is OpenAI compatible
      this.isOpenAICompatible = config.ai.apiUrl.includes('openai.com') ||
        config.ai.apiUrl.includes('api.openai.com');

      if (this.isOpenAICompatible) {
        this.openai = new OpenAI({
          apiKey: config.ai.apiKey,
          baseURL: config.ai.apiUrl
        });
      }
    } catch (error) {
      console.error('Failed to initialize AI client:', error);
      throw new AIServiceError('AI service initialization failed', 'INIT_FAILED', 500);
    }
  }

  // Generate recipes by ingredients
  async generateRecipesByIngredients(
    ingredients: string[],
    dietaryRestrictions: DietaryRestriction[] = [],
    servingSize: number = 4,
    cuisinePreference?: string
  ): Promise<RecipeSuggestion[]> {
    const prompt = this.buildIngredientsPrompt(ingredients, dietaryRestrictions, servingSize, cuisinePreference);

    try {
      const response = await this.makeAIRequest(prompt);
      console.log("response", response)
      return this.parseRecipeSuggestions(response.replace(/```json|```/g, '').trim());
    } catch (error) {
      throw new AIServiceError('Failed to generate recipes by ingredients', 'GENERATION_FAILED', 500);
    }
  }

  // Generate recipe variations by food name
  async generateRecipeVariations(
    foodName: string,
    dietaryRestrictions: DietaryRestriction[] = [],
    servingSize: number = 4
  ): Promise<RecipeVariation[]> {
    const prompt = this.buildFoodNamePrompt(foodName, dietaryRestrictions, servingSize);

    try {
      const response = await this.makeAIRequest(prompt);
      return this.parseRecipeVariations(response.replace(/```json|```/g, '').trim());
    } catch (error) {
      throw new AIServiceError('Failed to generate recipe variations', 'GENERATION_FAILED', 500);
    }
  }

  // Generate detailed recipe instructions
  async generateRecipeInstructions(
    recipeName: string,
    ingredients: string[],
    dietaryRestrictions: DietaryRestriction[] = [],
    servingSize: number = 4
  ): Promise<{ instructions: string[]; cookingTime: number; difficulty: number }> {
    const prompt = this.buildInstructionsPrompt(recipeName, ingredients, dietaryRestrictions, servingSize);

    try {
      const response = await this.makeAIRequest(prompt);
      return this.parseInstructions(response.replace(/```json|```/g, '').trim());
    } catch (error) {
      throw new AIServiceError('Failed to generate recipe instructions', 'GENERATION_FAILED', 500);
    }
  }

  // Generate nutritional information
  async generateNutritionalInfo(
    recipeName: string,
    ingredients: string[],
    servingSize: number = 4
  ): Promise<NutritionalInfo> {
    const prompt = this.buildNutritionPrompt(recipeName, ingredients, servingSize);

    try {
      const response = await this.makeAIRequest(prompt);
      return this.parseNutritionalInfo(response.replace(/```json|```/g, '').trim(), servingSize);
    } catch (error) {
      throw new AIServiceError('Failed to generate nutritional information', 'GENERATION_FAILED', 500);
    }
  }

  // Generate ingredient substitutions
  async generateIngredientSubstitutions(
    ingredient: string,
    dietaryRestrictions: DietaryRestriction[],
    recipeContext: string
  ): Promise<IngredientSubstitution[]> {
    const prompt = this.buildSubstitutionPrompt(ingredient, dietaryRestrictions, recipeContext);

    try {
      const response = await this.makeAIRequest(prompt);
      return this.parseSubstitutions(response.replace(/```json|```/g, '').trim(), dietaryRestrictions);
    } catch (error) {
      throw new AIServiceError('Failed to generate ingredient substitutions', 'GENERATION_FAILED', 500);
    }
  }

  // Analyze dietary compatibility
  async analyzeDietaryCompatibility(
    recipeName: string,
    ingredients: string[],
    instructions: string[],
    dietaryRestrictions: DietaryRestriction[]
  ): Promise<{ compatible: boolean; issues: string[]; suggestions: string[] }> {
    const prompt = this.buildDietaryAnalysisPrompt(recipeName, ingredients, instructions, dietaryRestrictions);

    try {
      const response = await this.makeAIRequest(prompt);
      return this.parseDietaryAnalysis(response.replace(/```json|```/g, '').trim());
    } catch (error) {
      throw new AIServiceError('Failed to analyze dietary compatibility', 'ANALYSIS_FAILED', 500);
    }
  }

  // Make AI request (handles both OpenAI and custom APIs)
  private async makeAIRequest(prompt: string): Promise<string> {
    try {
      if (this.isOpenAICompatible && this.openai) {
        const completion = await this.openai.chat.completions.create({
          model: config.ai.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: config.ai.maxTokens,
          temperature: config.ai.temperature
        });

        return completion.choices[0]?.message?.content || '';
      } else {
        // Custom API request
        const response = await axios.post(
          `${config.ai.apiUrl}/chat/completions`,
          {
            model: config.ai.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: config.ai.maxTokens,
            temperature: config.ai.temperature, response_format: {
              type: "json_schema",
              json_schema: {
                name: "recipe_suggestions",
                strict: true,
                schema: {
                  type: "array",
                  items: { type: "object", additionalProperties: true }
                }
              }
            }
          },
          {
            headers: getAIHeaders(),
            timeout: 30000
          }
        );

        return response.data.choices[0]?.message?.content || '';
      }
    } catch (error) {
      console.error('AI request failed:', error);
      throw new AIServiceError('AI API request failed', 'API_ERROR', 500);
    }
  }

  // Build prompts for different use cases
  private buildIngredientsPrompt(
    ingredients: string[],
    dietaryRestrictions: DietaryRestriction[],
    servingSize: number,
    cuisinePreference?: string
  ): string {
    const restrictionsText = dietaryRestrictions.length > 0
      ? `Dietary restrictions: ${dietaryRestrictions.join(', ')}`
      : 'No dietary restrictions';

    const cuisineText = cuisinePreference
      ? `Preferred cuisine: ${cuisinePreference}`
      : 'Any cuisine';

    return `You are a professional chef and nutritionist AI. Generate recipe suggestions based on available ingredients while considering dietary restrictions.

Available ingredients: ${ingredients.join(', ')}
${restrictionsText}
${cuisineText}
Serving size: ${servingSize} people

Requirements:
1. Suggest 3-5 diverse recipe options that can be made with the available ingredients
2. Include difficulty level (1-5 stars)
3. Estimated cooking time in minutes
4. Nutritional highlights
5. Ingredient substitutions for dietary needs if applicable
6. Cultural context if applicable

Format your response as a JSON array with this structure:
[
  {
    "name": "Recipe Name",
    "description": "Brief description",
    "ingredients": [
      {"name": "ingredient", "amount": 2, "unit": "cups", "notes": "optional notes"}
    ],
    "instructions": ["step 1", "step 2", "step 3"],
    "cookingTime": 30,
    "difficulty": 3,
    "cuisine": "Italian",
    "tags": ["quick", "healthy"],
    "nutritionalHighlights": ["high protein", "low carb"],
    "dietaryCompatibility": ["vegetarian"],
    "confidence": 0.9
  }
]

Ensure all recipes are practical, safe, and delicious.`;
  }

  private buildFoodNamePrompt(
    foodName: string,
    dietaryRestrictions: DietaryRestriction[],
    servingSize: number
  ): string {
    const restrictionsText = dietaryRestrictions.length > 0
      ? `Dietary restrictions: ${dietaryRestrictions.join(', ')}`
      : 'No dietary restrictions';

    return `You are a culinary expert AI specializing in recipe variations and cultural adaptations.

Food requested: ${foodName}
${restrictionsText}
Serving size: ${servingSize} people

Requirements:
1. Generate 4-6 variations of the requested dish
2. Include traditional and modern interpretations
3. Adapt for dietary restrictions without losing authenticity
4. Provide difficulty and time estimates
5. Highlight unique ingredients or techniques
6. Include regional variations

Format your response as a JSON array with this structure:
[
  {
    "name": "Variation Name",
    "description": "Description of this variation",
    "variation": "What makes this version unique",
    "culturalContext": "Cultural background if applicable",
    "ingredients": [
      {"name": "ingredient", "amount": 2, "unit": "cups", "notes": "optional notes"}
    ],
    "instructions": ["step 1", "step 2", "step 3"],
    "cookingTime": 45,
    "difficulty": 4,
    "uniqueFeatures": ["feature 1", "feature 2"]
  }
]

Ensure variations are authentic and respect cultural traditions while accommodating dietary needs.`;
  }

  private buildInstructionsPrompt(
    recipeName: string,
    ingredients: string[],
    dietaryRestrictions: DietaryRestriction[],
    servingSize: number
  ): string {
    return `You are a professional chef AI. Generate detailed cooking instructions for the following recipe.

Recipe: ${recipeName}
Ingredients: ${ingredients.join(', ')}
Dietary restrictions: ${dietaryRestrictions.join(', ') || 'None'}
Serving size: ${servingSize} people

Requirements:
1. Provide step-by-step cooking instructions
2. Include timing for each step
3. Mention important techniques and tips
4. Estimate total cooking time
5. Assess difficulty level (1-5)
6. Include safety notes if needed

Format your response as JSON:
{
  "instructions": ["detailed step 1", "detailed step 2", "detailed step 3"],
  "cookingTime": 45,
  "difficulty": 3,
  "tips": ["tip 1", "tip 2"],
  "safetyNotes": ["safety note 1"]
}

Make instructions clear and beginner-friendly while maintaining professional quality.`;
  }

  private buildNutritionPrompt(
    recipeName: string,
    ingredients: string[],
    servingSize: number
  ): string {
    return `You are a certified nutritionist AI. Analyze the nutritional content of this recipe.

Recipe: ${recipeName}
Ingredients: ${ingredients.join(', ')}
Serving size: ${servingSize} people

Requirements:
1. Calculate nutritional values per serving
2. Include macronutrients (calories, protein, carbs, fat)
3. Include micronutrients (fiber, sugar, sodium)
4. Estimate key vitamins and minerals
5. Provide health benefits

Format your response as JSON:
{
  "calories": 350,
  "protein": 25.5,
  "carbohydrates": 45.2,
  "fat": 12.8,
  "fiber": 8.5,
  "sugar": 6.2,
  "sodium": 580,
  "vitamins": {
    "vitaminC": 15.5,
    "vitaminA": 850
  },
  "minerals": {
    "iron": 3.2,
    "calcium": 120
  }
}

Base calculations on standard nutritional databases and provide realistic estimates.`;
  }

  private buildSubstitutionPrompt(
    ingredient: string,
    dietaryRestrictions: DietaryRestriction[],
    recipeContext: string
  ): string {
    return `You are a culinary expert AI specializing in ingredient substitutions.

Original ingredient: ${ingredient}
Dietary restrictions: ${dietaryRestrictions.join(', ') || 'None'}
Recipe context: ${recipeContext}

Requirements:
1. Suggest 3-5 suitable substitutions
2. Consider dietary restrictions
3. Maintain recipe integrity
4. Explain substitution ratios
5. Note flavor and texture impacts
6. Provide confidence scores

Format your response as JSON:
[
  {
    "substitute": "substitute ingredient",
    "ratio": 1.0,
    "reason": "why this substitution works",
    "dietaryRestriction": "vegan",
    "confidenceScore": 0.9,
    "flavorImpact": "minimal",
    "textureImpact": "slightly different"
  }
]

Ensure substitutions are practical and maintain the dish's character.`;
  }

  private buildDietaryAnalysisPrompt(
    recipeName: string,
    ingredients: string[],
    instructions: string[],
    dietaryRestrictions: DietaryRestriction[]
  ): string {
    return `You are a dietary specialist AI. Analyze this recipe for compatibility with dietary restrictions.

Recipe: ${recipeName}
Ingredients: ${ingredients.join(', ')}
Instructions: ${instructions.join(' ')}
Dietary restrictions to check: ${dietaryRestrictions.join(', ')}

Requirements:
1. Check compatibility with each restriction
2. Identify specific issues
3. Suggest modifications
4. Provide overall compatibility score

Format your response as JSON:
{
  "compatible": true,
  "issues": ["issue 1", "issue 2"],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "compatibilityScore": 0.8
}

Be thorough and consider hidden ingredients and cross-contamination risks.`;
  }

  // Parse AI responses
  private parseRecipeSuggestions(response: string): RecipeSuggestion[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (error) {
      console.error('Failed to parse recipe suggestions:', error);
      return [];
    }
  }

  private parseRecipeVariations(response: string): RecipeVariation[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (error) {
      console.error('Failed to parse recipe variations:', error);
      return [];
    }
  }

  private parseInstructions(response: string): { instructions: string[]; cookingTime: number; difficulty: number } {
    try {
      const parsed = JSON.parse(response);
      return {
        instructions: parsed.instructions || [],
        cookingTime: parsed.cookingTime || 30,
        difficulty: parsed.difficulty || 3
      };
    } catch (error) {
      console.error('Failed to parse instructions:', error);
      return { instructions: [], cookingTime: 30, difficulty: 3 };
    }
  }

  private parseNutritionalInfo(response: string, servingSize: number): NutritionalInfo {
    try {
      const parsed = JSON.parse(response);
      return {
        calories: parsed.calories || 0,
        protein: parsed.protein || 0,
        carbohydrates: parsed.carbohydrates || 0,
        fat: parsed.fat || 0,
        fiber: parsed.fiber || 0,
        sugar: parsed.sugar || 0,
        sodium: parsed.sodium || 0,
        vitamins: parsed.vitamins || {},
        minerals: parsed.minerals || {},
        servingSize
      };
    } catch (error) {
      console.error('Failed to parse nutritional info:', error);
      return {
        calories: 0, protein: 0, carbohydrates: 0, fat: 0,
        fiber: 0, sugar: 0, sodium: 0, vitamins: {}, minerals: {},
        servingSize
      };
    }
  }

  private parseSubstitutions(response: string, dietaryRestrictions: DietaryRestriction[]): IngredientSubstitution[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (error) {
      console.error('Failed to parse substitutions:', error);
      return [];
    }
  }

  private parseDietaryAnalysis(response: string): { compatible: boolean; issues: string[]; suggestions: string[] } {
    try {
      const parsed = JSON.parse(response);
      return {
        compatible: parsed.compatible || false,
        issues: parsed.issues || [],
        suggestions: parsed.suggestions || []
      };
    } catch (error) {
      console.error('Failed to parse dietary analysis:', error);
      return { compatible: false, issues: [], suggestions: [] };
    }
  }
}

// Singleton instance
export const aiService = new AIService();