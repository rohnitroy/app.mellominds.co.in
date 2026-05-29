import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current directory of THIS file (backend/config)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Correctly point to backend/.env (located up one level from config/ if running from root, or relative to this file)
// Since this file is in backend/config/env.js, .env is in backend/.env which is ../.env
dotenv.config({ path: join(__dirname, '../.env') });

console.log('Environment variables loaded from:', join(__dirname, '../.env'));
