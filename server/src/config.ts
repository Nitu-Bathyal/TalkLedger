import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'talkledger-development-secret-jwt-key-32chars',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // Google Gemma 2 Configuration (Open-Weights LLM)
  groqApiKey: process.env.GROQ_API_KEY || '',
  hfToken: process.env.HF_TOKEN || '',
  gemmaModel: process.env.GEMMA_MODEL || 'gemma2-9b-it',
  gemmaApiBaseUrl: process.env.GEMMA_API_BASE_URL || '',
  gemmaProvider: process.env.GEMMA_PROVIDER || '',

  // TabPFN-3.5 Configuration
  tabpfnApiKey: process.env.TABPFN_API_KEY || process.env.TABPFN_TOKEN || '',
  tabpfnApiBaseUrl: process.env.TABPFN_API_BASE_URL || 'https://api.tabpfn.com/v1',

  // Database URL for Render / SQLite
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
};
