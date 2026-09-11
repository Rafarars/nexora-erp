import { z } from 'zod';

// Los valores por defecto solo aplican fuera de produccion: alli un olvido de
// configuracion debe romper el arranque, no degradar la aplicacion en silencio.
export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z
      .string()
      .refine((value) => /^postgres(ql)?:\/\//.test(value), {
        message: 'DATABASE_URL must be a PostgreSQL connection string',
      }),
    // Firma los tokens de sesion. El valor por defecto solo sirve en desarrollo: en
    // produccion se exige uno propio y largo, mas abajo.
    JWT_SECRET: z.string().min(1).default('development-only-secret-do-not-use'),
    // Cuanto dura una sesion. Corta a proposito: cambiar de empresa reemite el token.
    JWT_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;

    if (env.DATABASE_URL.includes('localhost')) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL points to localhost while NODE_ENV=production',
      });
    }

    // Arrancar produccion con el secreto de ejemplo permitiria a cualquiera que lea
    // el repositorio firmar un token valido.
    if (env.JWT_SECRET === 'development-only-secret-do-not-use') {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be set to a private value while NODE_ENV=production',
      });
    }

    if (env.JWT_SECRET.length < 32) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be at least 32 characters while NODE_ENV=production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');

    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return result.data;
}
