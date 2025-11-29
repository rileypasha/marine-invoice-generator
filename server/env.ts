import path from 'path';
import dotenv from 'dotenv';

const envFile = process.env.MG_ENV_FILE || path.resolve(process.cwd(), '.env');
const result = dotenv.config({ path: envFile });

if (result.error && process.env.NODE_ENV !== 'production') {
  console.warn(`[env] Could not load environment file at ${envFile}. Using current process env only.`);
}
