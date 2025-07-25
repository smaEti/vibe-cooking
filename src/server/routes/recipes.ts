import { Router, Request, Response } from 'express';
import { recipeService } from '@/server/services/recipeService';
import { 
  CreateRecipeRequest, 
  ScaleRecipeRequest, 
  SubstituteIngredientRequest,
  DietaryRestriction,
  RecipeError,
  ValidationError 
} from '@/types';
import Joi from 'joi';

const router = Router();

// Validation schemas
const ingredientsRequestSchema = Joi.object({
  ingredients: Joi.array().items(Joi.string().trim().min(1)).min(1).required(),
  dietaryRestrictions: Joi.array().items(Joi.string().valid(...Object.values(DietaryRestriction))).default([]),
  servingSize: Joi.number().integer().min(1).max(20).default(4),
  cuisinePreference: Joi.string().trim().optional(),
  userId: Joi.string().trim().optional()
});

const foodNameRequestSchema = Joi.object({
  foodName: Joi.string().trim().min(1).required(),
  dietaryRestrictions: Joi.array().items(Joi.string().valid(...Object.values(DietaryRestriction))).default([]),
  servingSize: Joi.number().integer().min(1).max(20).default(4),
  userId: Joi.string().trim().optional()
});

const scaleRequestSchema = Joi.object({
  recipeId: Joi.string().trim().required(),
  newServingSize: Joi.number().integer().min(1).max(20).required()
});

const substituteRequestSchema = Joi.object({
  ingredient: Joi.string().trim().min(1).required(),
  dietaryRestrictions: Joi.array().items(Joi.string().valid(...Object.values(DietaryRestriction))).min(1).required(),
  recipeContext: Joi.string().trim().required()
});

// Middleware for validation
const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: Function) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(d => d.message)
      });
    }
    req.body = value;
    next();
  };
};

// Error handler middleware
const handleError = (error: any, res: Response) => {
  console.error('Recipe route error:', error);
  
  if (error instanceof RecipeError) {
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.code
    });
  }
  
  if (error instanceof ValidationError) {
    return res.status(error.statusCode).json({
      error: error.message,
      field: error.field
    });
  }
  
  return res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
};

// Routes

/**
 * POST /api/recipes/by-ingredients
 * Get recipes by ingredients with dietary filters
 */
router.post('/by-ingredients', validateRequest(ingredientsRequestSchema), async (req: Request, res: Response) => {
  try {
    const { ingredients, dietaryRestrictions, servingSize, cuisinePreference, userId } = req.body;
    
    const suggestions = await recipeService.getRecipesByIngredients(
      ingredients,
      dietaryRestrictions,
      servingSize,
      cuisinePreference,
      userId
    );
    
    res.json({
      success: true,
      data: suggestions,
      meta: {
        count: suggestions.length,
        servingSize,
        dietaryRestrictions
      }
    });
  } catch (error) {
    handleError(error, res);
  }
});

/**
 * POST /api/recipes/by-name
 * Get recipe variations by food name with dietary considerations
 */
router.post('/by-name', validateRequest(foodNameRequestSchema), async (req: Request, res: Response) => {
  try {
    const { foodName, dietaryRestrictions, servingSize, userId } = req.body;
    
    const variations = await recipeService.getRecipeVariationsByName(
      foodName,
      dietaryRestrictions,
      servingSize,
      userId
    );
    
    res.json({
      success: true,
      data: variations,
      meta: {
        count: variations.length,
        foodName,
        servingSize,
        dietaryRestrictions
      }
    });
  } catch (error) {
    handleError(error, res);
  }
});

/**
 * GET /api/recipes/:id
 * Get specific recipe details with nutritional info
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const servingSize = req.query.servingSize ? parseInt(req.query.servingSize as string) : undefined;
    
    if (!id || id.trim() === '') {
      return res.status(400).json({
        error: 'Recipe ID is required',
        code: 'MISSING_ID'
      });
    }
    
    const recipe = await recipeService.getRecipeWithNutrition(id, servingSize);
    
    if (!recipe) {
      return res.status(404).json({
        error: 'Recipe not found',
        code: 'NOT_FOUND'
      });
    }
    
    res.json({
      success: true,
      data: recipe
    });
  } catch (error) {
    handleError(error, res);
  }
});

/**
 * POST /api/recipes/:id/scale
 * Scale recipe for different serving sizes
 */
router.post('/:id/scale', validateRequest(scaleRequestSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newServingSize } = req.body;
    
    const scaledRecipe = await recipeService.scaleRecipe({
      recipeId: id,
      newServingSize
    });
    
    res.json({
      success: true,
      data: scaledRecipe,
      meta: {
        originalServingSize: scaledRecipe.servingSize,
        newServingSize,
        scaled: true
      }
    });
  } catch (error) {
    handleError(error, res);
  }
});

/**
 * POST /api/recipes/:id/substitute
 * Get ingredient substitutions for dietary needs
 */
router.post('/:id/substitute', validateRequest(substituteRequestSchema), async (req: Request, res: Response) => {
  try {
    const { ingredient, dietaryRestrictions, recipeContext } = req.body;
    
    const substitutions = await recipeService.getIngredientSubstitutions({
      ingredient,
      dietaryRestrictions,
      recipeContext
    });
    
    res.json({
      success: true,
      data: substitutions,
      meta: {
        originalIngredient: ingredient,
        dietaryRestrictions,
        count: substitutions.length
      }
    });
  } catch (error) {
    handleError(error, res);
  }
});

/**
 * POST /api/recipes/create-detailed
 * Create detailed recipe from suggestion
 */
router.post('/create-detailed', async (req: Request, res: Response) => {
  try {
    const { suggestion, userId } = req.body;
    
    if (!suggestion || !suggestion.name) {
      return res.status(400).json({
        error: 'Recipe suggestion is required',
        code: 'MISSING_SUGGESTION'
      });
    }
    
    const detailedRecipe = await recipeService.createDetailedRecipe(suggestion, userId);
    
    res.status(201).json({
      success: true,
      data: detailedRecipe
    });
  } catch (error) {
    handleError(error, res);
  }
});

/**
 * GET /api/recipes/popular
 * Get popular recipes with dietary filtering
 */
router.get('/popular', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const dietaryRestrictions = req.query.dietaryRestrictions 
      ? (req.query.dietaryRestrictions as string).split(',') as DietaryRestriction[]
      : [];
    const userId = req.query.userId as string;
    
    if (limit < 1 || limit > 50) {
      return res.status(400).json({
        error: 'Limit must be between 1 and 50',
        code: 'INVALID_LIMIT'
      });
    }
    
    const recipes = await recipeService.getPopularRecipes(limit, dietaryRestrictions, userId);
    
    res.json({
      success: true,
      data: recipes,
      meta: {
        count: recipes.length,
        limit,
        dietaryRestrictions
      }
    });
  } catch (error) {
    handleError(error, res);
  }
});

/**
 * GET /api/recipes/search
 * Search recipes with dietary filtering
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    const dietaryRestrictions = req.query.dietaryRestrictions 
      ? (req.query.dietaryRestrictions as string).split(',') as DietaryRestriction[]
      : [];
    const userId = req.query.userId as string;
    
    if (!query || query.trim() === '') {
      return res.status(400).json({
        error: 'Search query is required',
        code: 'MISSING_QUERY'
      });
    }
    
    const recipes = await recipeService.searchRecipes(query, dietaryRestrictions, userId);
    
    res.json({
      success: true,
      data: recipes,
      meta: {
        count: recipes.length,
        query,
        dietaryRestrictions
      }
    });
  } catch (error) {
    handleError(error, res);
  }
});

export default router;