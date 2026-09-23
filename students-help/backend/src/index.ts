import 'dotenv/config';
import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { logger } from './shared/logger.js';

const env = loadEnv();
const app = createApp({ env });

app.listen(env.PORT, () => {
  logger.info('Students-Help API listening', { port: env.PORT });
});
