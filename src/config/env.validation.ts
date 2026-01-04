import { z } from 'zod';

export const EnvSchema = z.object({
  // Database
  DATABASE_URL: z.string().url('Invalid DATABASE_URL format'),

  // JWT
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters for security'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters for security'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Application
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.string().default('3000').transform(Number),

  // Security
  BCRYPT_SALT_ROUNDS: z.string().default('10').transform(Number),
  THROTTLE_TTL: z.string().default('60000').transform(Number),
  THROTTLE_LIMIT: z.string().default('10').transform(Number),

  // CORS (optional, for production)
  CORS_ORIGIN: z.string().optional(),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export function validate(config: Record<string, unknown>) {
  try {
    return EnvSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      console.error('❌ Environment validation failed:');
      issues.forEach(({ path, message }) => {
        console.error(`  - ${path}: ${message}`);
      });
      process.exit(1);
    }
    throw error;
  }
}
