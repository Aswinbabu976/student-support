import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'file:./test.db';
process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
process.env.APP_PUBLIC_URL = 'http://localhost:5173';
process.env.BCRYPT_COST = '4';
process.env.VERIFICATION_TOKEN_TTL_HOURS = '24';
process.env.SESSION_TTL_HOURS = '24';
process.env.UNIVERSITY_EMAIL_DOMAINS = 'hs-heilbronn.de,uni-stuttgart.de,tum.de';
process.env.LOG_VERIFICATION_LINKS = 'false';
process.env.PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER ?? 'mock';

execSync('npx prisma migrate deploy', {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
});
