import { z } from 'zod';

const optionalBooleanFromString = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => {
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
    return undefined;
  });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),
  APP_PUBLIC_URL: z.string().url().default('http://localhost:5173'),
  BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),
  VERIFICATION_TOKEN_TTL_HOURS: z.coerce.number().int().positive().default(24),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(168),
  UNIVERSITY_EMAIL_DOMAINS: z.string().min(1),
  LOG_VERIFICATION_LINKS: optionalBooleanFromString,
  PAYMENT_PROVIDER: z.enum(['mock', 'stripe']).default('mock'),
  PAYMENT_SECRET_KEY: z.string().optional().default(''),
  PAYMENT_PUBLIC_KEY: z.string().optional().default(''),
  PAYMENT_WEBHOOK_SECRET: z.string().optional().default(''),
});

export type AppEnv = Omit<z.infer<typeof envSchema>, 'LOG_VERIFICATION_LINKS'> & {
  LOG_VERIFICATION_LINKS: boolean;
};

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    throw new Error(`Invalid environment configuration: ${JSON.stringify(details)}`);
  }

  const env = {
    ...parsed.data,
    LOG_VERIFICATION_LINKS:
      parsed.data.LOG_VERIFICATION_LINKS ?? parsed.data.NODE_ENV !== 'production',
  };

  if (env.PAYMENT_SECRET_KEY.startsWith('sk_live_') || env.PAYMENT_PUBLIC_KEY.startsWith('pk_live_')) {
    throw new Error('Live payment credentials are not allowed. Use test/sandbox keys only.');
  }

  if (
    env.PAYMENT_PROVIDER === 'stripe' &&
    env.NODE_ENV === 'production' &&
    !env.PAYMENT_SECRET_KEY.startsWith('sk_test_')
  ) {
    throw new Error('PAYMENT_SECRET_KEY test secret is required when PAYMENT_PROVIDER=stripe.');
  }

  return env;
}

export function parseUniversityDomains(csv: string): string[] {
  const domains = csv
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter((domain) => domain.length > 0);

  return [...new Set(domains)];
}
