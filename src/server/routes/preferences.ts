import { Router, Request, Response } from 'express';
import { DietaryProfileModel } from '@/server/models/DietaryProfile';
import { 
  DietaryRestriction,
  UserPreferencesRequest,
  RecipeError,
  ValidationError 
} from '@/types';
import Joi from 'joi';

const router = Router();

// Validation schemas
const preferencesSchema = Joi.object({
  userId: Joi.string().trim().min(1).required(),
  allergies: Joi.array().items(Joi.string().valid(...Object.values(DietaryRestriction))).default([]),
  dietaryPreferences: Joi.array().items(Joi.string().valid(...Object.values(DietaryRestriction))).default([]),
  healthConditions: Joi.array().items(Joi.string().valid(...Object.values(DietaryRestriction))).default([]),
  nutritionalGoals: Joi.object({
    dailyCalories: Joi.number().integer().min(800).max(5000).optional(),
    proteinPercentage: Joi.number().min(5).max(50).optional(),
    carbPercentage: Joi.number().min(10).max(80).optional(),
    fatPercentage: Joi.number().min(10).max(60).optional(),
    fiberGoal: Joi.number().min(10).max(100).optional(),
    sodiumLimit: Joi.number().min(500).max(5000).optional(),
    goal: Joi.string().valid('weight_loss', 'weight_gain', 'maintenance', 'muscle_gain').required()
  }).required()
});

const updatePreferencesSchema = Joi.object({
  allergies: Joi.array().items(Joi.string().valid(...Object.values(DietaryRestriction))).optional(),
  dietaryPreferences: Joi.array().items(Joi.string().valid(...Object.values(DietaryRestriction))).optional(),
  healthConditions: Joi.array().items(Joi.string().valid(...Object.values(DietaryRestriction))).optional(),
  nutritionalGoals: Joi.object({
    dailyCalories: Joi.number().integer().min(800).max(5000).optional(),
    proteinPercentage: Joi.number().min(5).max(50).optional(),
    carbPercentage: Joi.number().min(10).max(80).optional(),
    fatPercentage: Joi.number().min(10).max(60).optional(),
    fiberGoal: Joi.number().min(10).max(100).optional(),
    sodiumLimit: Joi.number().min(500).max(5000).optional(),
    goal: Joi.string().valid('weight_loss', 'weight_gain', 'maintenance', 'muscle_gain').optional()
  }).optional()
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
  console.error('Preferences route error:', error);
  
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
 * GET /api/preferences/:userId
 * Get user dietary preferences
 */
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    if (!userId || userId.trim() === '') {
      return res.status(400).json({
        error: 'User ID is required',
        code: 'MISSING_USER_ID'
      });
    }
    
    const profile = await DietaryProfileModel.findByUserId(userId);
    
    if (!profile) {
      return res.status(404).json({
        error: 'User preferences not found',
        code: 'NOT_FOUND'
      });
    }
    
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    handleError(error, res);
  }
});

/**
 * POST /api/preferences
 * Save user dietary preferences
 */
router.post('/', validateRequest(preferencesSchema), async (req: Request, res: Response) => {
  try {
    const { userId, allergies, dietaryPreferences, healthConditions, nutritionalGoals } = req.body;
    
    // Validate that percentages add up to 100% if all are provided
    if (nutritionalGoals.proteinPercentage && nutritionalGoals.carbPercentage && nutritionalGoals.fatPercentage) {
      const total = nutritionalGoals.proteinPercentage + nutritionalGoals.carbPercentage + nutritionalGoals.fatPercentage;
      if (Math.abs(total - 100) > 1) { // Allow 1% tolerance for rounding
        return res.status(400).json({
          error: 'Protein, carbohydrate, and fat percentages must add up to 100%',
          code: 'INVALID_PERCENTAGES'
        });
      }
    }
    
    const profile = await DietaryProfileModel.createOrUpdate(userId, {
      allergies,
      dietaryPreferences,
      healthConditions,
      nutritionalGoals
    });
    
    res.status(201).json({
      success: true,
      data: profile
    });
  } catch (error) {
    handleError(error, res);
  }
});

/**
 * PUT /api/preferences/:userId
 * Update user dietary preferences
 */
router.put('/:userId', validateRequest(updatePreferencesSchema), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    
    if (!userId || userId.trim() === '') {
      return res.status(400).json({
        error: 'User ID is required',
        code: 'MISSING_USER_ID'
      });
    }
    
    // Check if profile exists
    const existingProfile = await DietaryProfileModel.findByUserId(userId);
    if (!existingProfile) {
      return res.status(404).json({
        error: 'User preferences not found',
        code: 'NOT_FOUND'
      });
    }
    
    // Validate percentages if provided
    if (updates.nutritionalGoals) {
      const goals = { ...existingProfile.nutritionalGoals, ...updates.nutritionalGoals };
      if (goals.proteinPercentage && goals.carbPercentage && goals.fatPercentage) {
        const total = goals.proteinPercentage + goals.carbPercentage + goals.fatPercentage;
        if (Math.abs(total - 100) > 1) {
          return res.status(400).json({
            error: 'Protein, carbohydrate, and fat percentages must add up to 100%',
            code: 'INVALID_PERCENTAGES'
          });
        }
      }
    }
    
    const updatedProfile = await DietaryProfileModel.update(existingProfile.id, updates);
    
    res.json({
      success: true,
      data: updatedProfile
    });
  } catch (error) {
    handleError(error, res);
  }
});

/**
 * DELETE /api/preferences/:userId
 * Delete user dietary preferences
 */
router.delete('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    if (!userId || userId.trim() === '') {
      return res.status(400).json({
        error: 'User ID is required',
        code: 'MISSING_USER_ID'
      });
    }
    
    const profile = await DietaryProfileModel.findByUserId(userId);
    if (!profile) {
      return res.status(404).json({
        error: 'User preferences not found',
        code: 'NOT_FOUND'
      });
    }
    
    await DietaryProfileModel.delete(profile.id);
    
    res.json({
      success: true,
      message: 'User preferences deleted successfully'
    });
  } catch (error) {
    handleError(error, res);
  }
});

/**
 * GET /api/preferences/:userId/restrictions
 * Get all dietary restrictions for a user (combined allergies, preferences, and health conditions)
 */
router.get('/:userId/restrictions', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    if (!userId || userId.trim() === '') {
      return res.status(400).json({
        error: 'User ID is required',
        code: 'MISSING_USER_ID'
      });
    }
    
    const restrictions = await DietaryProfileModel.getAllRestrictions(userId);
    
    res.json({
      success: true,
      data: {
        restrictions,
        count: restrictions.length
      }
    });
  } catch (error) {
    handleError(error, res);
  }
});

/**
 * GET /api/preferences/:userId/goals
 * Get nutritional goals for a user
 */
router.get('/:userId/goals', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    if (!userId || userId.trim() === '') {
      return res.status(400).json({
        error: 'User ID is required',
        code: 'MISSING_USER_ID'
      });
    }
    
    const goals = await DietaryProfileModel.getNutritionalGoals(userId);
    
    if (!goals) {
      return res.status(404).json({
        error: 'Nutritional goals not found',
        code: 'NOT_FOUND'
      });
    }
    
    res.json({
      success: true,
      data: goals
    });
  } catch (error) {
    handleError(error, res);
  }
});

/**
 * POST /api/preferences/:userId/check-restriction
 * Check if user has a specific dietary restriction
 */
router.post('/:userId/check-restriction', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { restriction } = req.body;
    
    if (!userId || userId.trim() === '') {
      return res.status(400).json({
        error: 'User ID is required',
        code: 'MISSING_USER_ID'
      });
    }
    
    if (!restriction || !Object.values(DietaryRestriction).includes(restriction)) {
      return res.status(400).json({
        error: 'Valid dietary restriction is required',
        code: 'INVALID_RESTRICTION'
      });
    }
    
    const hasRestriction = await DietaryProfileModel.hasRestriction(userId, restriction);
    
    res.json({
      success: true,
      data: {
        userId,
        restriction,
        hasRestriction
      }
    });
  } catch (error) {
    handleError(error, res);
  }
});

/**
 * GET /api/preferences/dietary-restrictions
 * Get all available dietary restriction options
 */
router.get('/dietary-restrictions', async (req: Request, res: Response) => {
  try {
    const restrictions = Object.values(DietaryRestriction).map(restriction => ({
      value: restriction,
      label: restriction.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      category: categorizeDietaryRestriction(restriction)
    }));
    
    res.json({
      success: true,
      data: restrictions
    });
  } catch (error) {
    handleError(error, res);
  }
});

// Helper function to categorize dietary restrictions
function categorizeDietaryRestriction(restriction: DietaryRestriction): string {
  const allergies = [
    DietaryRestriction.NUTS,
    DietaryRestriction.DAIRY,
    DietaryRestriction.GLUTEN,
    DietaryRestriction.SHELLFISH,
    DietaryRestriction.EGGS,
    DietaryRestriction.SOY,
    DietaryRestriction.FISH
  ];
  
  const preferences = [
    DietaryRestriction.VEGETARIAN,
    DietaryRestriction.VEGAN,
    DietaryRestriction.PESCATARIAN,
    DietaryRestriction.KETO,
    DietaryRestriction.PALEO,
    DietaryRestriction.MEDITERRANEAN
  ];
  
  const health = [
    DietaryRestriction.DIABETIC_FRIENDLY,
    DietaryRestriction.LOW_SODIUM,
    DietaryRestriction.HEART_HEALTHY,
    DietaryRestriction.LOW_CHOLESTEROL
  ];
  
  const cultural = [
    DietaryRestriction.HALAL,
    DietaryRestriction.KOSHER,
    DietaryRestriction.HINDU_VEGETARIAN
  ];
  
  if (allergies.includes(restriction)) return 'allergies';
  if (preferences.includes(restriction)) return 'dietary_preferences';
  if (health.includes(restriction)) return 'health_conditions';
  if (cultural.includes(restriction)) return 'cultural_religious';
  
  return 'other';
}

export default router;