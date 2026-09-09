import { z } from "zod";

// Solo para el servidor de Next: nunca importar desde un componente de cliente.
const schema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    API_URL: z.url().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return;

    if (!env.API_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["API_URL"],
        message: "API_URL is required in production",
      });
      return;
    }

    if (env.API_URL.includes("localhost")) {
      ctx.addIssue({
        code: "custom",
        path: ["API_URL"],
        message: "API_URL points to localhost while NODE_ENV=production",
      });
    }
  })
  // El valor por defecto solo existe fuera de produccion.
  .transform((env) => ({
    ...env,
    API_URL: env.API_URL ?? "http://localhost:3001",
  }));

type Env = z.infer<typeof schema>;

// Validacion perezosa: en la primera peticion, NO al importar el modulo.
// `next build` corre con NODE_ENV=production pero sin las variables de
// ejecucion, asi que validar al cargar romperia la compilacion.
let cached: Env | null = null;

export function getEnv(): Env {
  cached ??= parseEnv();
  return cached;
}

function parseEnv(): Env {
  const result = schema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    API_URL: process.env.API_URL,
  });

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");

    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return result.data;
}

