type LogLevel = 'info' | 'warn' | 'error';

function write(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const payload = {
    level,
    message,
    time: new Date().toISOString(),
    ...sanitize(context),
  };
  const line = JSON.stringify(payload);
  if (level === 'error') {
    process.stderr.write(`${line}\n`);
    return;
  }
  process.stdout.write(`${line}\n`);
}

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'token',
  'tokenDigest',
  'confirmPassword',
  'sessionToken',
  'secret',
  'secretKey',
  'PAYMENT_SECRET_KEY',
  'PAYMENT_WEBHOOK_SECRET',
  'client_secret',
  'clientSecret',
  'cardNumber',
  'card',
  'cvv',
  'cvc',
  'pan',
  'webhookSecret',
]);

function sanitize(context?: Record<string, unknown>): Record<string, unknown> {
  if (!context) {
    return {};
  }

  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (SENSITIVE_KEYS.has(key)) {
      safe[key] = '[redacted]';
      continue;
    }
    safe[key] = value;
  }
  return safe;
}

export const logger = {
  info(message: string, context?: Record<string, unknown>): void {
    write('info', message, context);
  },
  warn(message: string, context?: Record<string, unknown>): void {
    write('warn', message, context);
  },
  error(message: string, context?: Record<string, unknown>): void {
    write('error', message, context);
  },
};
