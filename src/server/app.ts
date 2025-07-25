import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';

import { config, validateConfig } from '@/server/utils/config';
import { database } from '@/server/models/database';

// Import routes
import recipesRouter from '@/server/routes/recipes';
import preferencesRouter from '@/server/routes/preferences';
import healthRouter from '@/server/routes/health';

// Validate configuration on startup
try {
  validateConfig();
  console.log('✅ Configuration validated successfully');
} catch (error) {
  console.error('❌ Configuration validation failed:', error);
  process.exit(1);
}

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  message: {
    error: 'Too many requests from this IP',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: Math.ceil(config.rateLimitWindowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Serve static files
app.use(express.static(path.join(__dirname, '../../public')));

// API Routes
app.use('/api/recipes', recipesRouter);
app.use('/api/preferences', preferencesRouter);
app.use('/api/health', healthRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'AI Recipe App',
    version: '1.0.0',
    description: 'AI-powered recipe application with dietary restrictions and nutritional analysis',
    endpoints: {
      health: '/api/health',
      config: '/api/health/config',
      recipes: {
        byIngredients: 'POST /api/recipes/by-ingredients',
        byName: 'POST /api/recipes/by-name',
        getRecipe: 'GET /api/recipes/:id',
        scaleRecipe: 'POST /api/recipes/:id/scale',
        substitute: 'POST /api/recipes/:id/substitute',
        popular: 'GET /api/recipes/popular',
        search: 'GET /api/recipes/search'
      },
      preferences: {
        get: 'GET /api/preferences/:userId',
        create: 'POST /api/preferences',
        update: 'PUT /api/preferences/:userId',
        delete: 'DELETE /api/preferences/:userId',
        restrictions: 'GET /api/preferences/:userId/restrictions',
        goals: 'GET /api/preferences/:userId/goals'
      }
    },
    documentation: 'See README.md for detailed API documentation'
  });
});

// Catch-all handler for SPA routing
app.get('*', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      error: 'API endpoint not found',
      code: 'NOT_FOUND',
      path: req.path
    });
  }
  
  // Serve index.html for all other routes (SPA routing)
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error handler:', error);
  
  // Handle JSON parsing errors
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({
      error: 'Invalid JSON in request body',
      code: 'INVALID_JSON'
    });
  }
  
  // Handle other errors
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    ...(config.nodeEnv === 'development' && { details: error.message })
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    code: 'NOT_FOUND',
    path: req.path
  });
});

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  try {
    // Close database connection
    await database.close();
    console.log('✅ Database connection closed');
    
    // Perform any other cleanup here
    
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Start server
const startServer = async () => {
  try {
    // Wait for database to be ready
    const dbHealthy = await database.healthCheck();
    if (!dbHealthy) {
      throw new Error('Database health check failed');
    }
    
    // Clean up old cache entries on startup
    await database.cleanupCache();
    
    const server = app.listen(config.port, () => {
      console.log(`
🚀 AI Recipe App Server Started
