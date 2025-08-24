import dotenv from 'dotenv';
import { AppConfig } from '../../types';

// Load environment variables
dotenv.config();

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databasePath: process.env.DATABASE_PATH || './data/recipes.db',
  cacheTtlHours: parseInt(process.env.CACHE_TTL_HOURS || '24', 10),
  cacheMaxEntries: parseInt(process.env.CACHE_MAX_ENTRIES || '1000', 10),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  ai: {
    apiUrl: process.env.AI_API_URL || 'https://api.openai.com/v1',
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || 'gpt-3.5-turbo',
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2000', 10),
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7')
  }
};

// Validate required configuration
export function validateConfig(): void {
  const requiredFields = [
    { key: 'AI_API_KEY', value: config.ai.apiKey, name: 'AI API Key' }
  ];

  const missingFields = requiredFields.filter(field => !field.value);
  
  if (missingFields.length > 0) {
    const missing = missingFields.map(field => field.name).join(', ');
    throw new Error(`Missing required configuration: ${missing}`);
  }

  // Validate AI API URL format
  try {
    new URL(config.ai.apiUrl);
  } catch (error) {
    throw new Error('Invalid AI_API_URL format');
  }

  // Validate numeric ranges
  if (config.ai.temperature < 0 || config.ai.temperature > 2) {
    throw new Error('AI_TEMPERATURE must be between 0 and 2');
  }

  if (config.ai.maxTokens < 1 || config.ai.maxTokens > 4000) {
    throw new Error('AI_MAX_TOKENS must be between 1 and 4000');
  }

  if (config.port < 1 || config.port > 65535) {
    throw new Error('PORT must be between 1 and 65535');
  }
}

// Development mode helpers
export const isDevelopment = (): boolean => config.nodeEnv === 'development';
export const isProduction = (): boolean => config.nodeEnv === 'production';

// Logging configuration
export const getLogLevel = (): string => {
  if (isDevelopment()) return 'debug';
  if (isProduction()) return 'warn';
  return 'info';
};

// Database configuration helpers
export const getDatabaseConfig = () => ({
  filename: config.databasePath,
  driver: 'sqlite3'
});

// AI service configuration helpers
export const getAIHeaders = () => ({
  'Authorization': `Bearer ${config.ai.apiKey}`,
  'Content-Type': 'application/json'
});

export const getAIRequestConfig = () => ({
  model: config.ai.model,
  max_tokens: config.ai.maxTokens,
  temperature: config.ai.temperature
});