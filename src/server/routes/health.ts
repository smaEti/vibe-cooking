import { Router, Request, Response } from 'express';
import { database } from '@/server/models/database';
import { config } from '@/server/utils/config';

const router = Router();

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    
    // Check database health
    const dbHealthy = await database.healthCheck();
    
    // Check AI service configuration
    const aiConfigured = !!(config.ai.apiKey && config.ai.apiUrl);
    
    const responseTime = Date.now() - startTime;
    
    const health = {
      status: dbHealthy && aiConfigured ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      services: {
        database: {
          status: dbHealthy ? 'healthy' : 'unhealthy',
          type: 'SQLite'
        },
        ai: {
          status: aiConfigured ? 'configured' : 'not_configured',
          model: config.ai.model,
          endpoint: config.ai.apiUrl.replace(/\/+$/, '') // Remove trailing slashes
        }
      },
      version: '1.0.0',
      environment: config.nodeEnv
    };
    
    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    console.error('Health check failed:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      services: {
        database: { status: 'unknown' },
        ai: { status: 'unknown' }
      }
    });
  }
});

/**
 * GET /api/config
 * Get available AI models and features
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    const configInfo = {
      ai: {
        model: config.ai.model,
        maxTokens: config.ai.maxTokens,
        temperature: config.ai.temperature,
        endpoint: config.ai.apiUrl.replace(/\/+$/, '')
      },
      features: {
        ingredientBasedRecipes: true,
        foodNameVariations: true,
        nutritionalAnalysis: true,
        ingredientSubstitutions: true,
        dietaryRestrictions: true,
        recipeScaling: true,
        recipeCaching: true
      },
      limits: {
        maxIngredients: 20,
        maxServingSize: 20,
        minServingSize: 1,
        cacheMaxEntries: config.cacheMaxEntries,
        cacheTtlHours: config.cacheTtlHours
      },
      supportedDietaryRestrictions: [
        'nuts', 'dairy', 'gluten', 'shellfish', 'eggs', 'soy', 'fish',
        'vegetarian', 'vegan', 'pescatarian', 'keto', 'paleo', 'mediterranean',
        'diabetic_friendly', 'low_sodium', 'heart_healthy', 'low_cholesterol',
        'halal', 'kosher', 'hindu_vegetarian'
      ]
    };
    
    res.json({
      success: true,
      data: configInfo
    });
  } catch (error) {
    console.error('Config endpoint failed:', error);
    
    res.status(500).json({
      error: 'Failed to retrieve configuration',
      code: 'CONFIG_ERROR'
    });
  }
});

export default router;