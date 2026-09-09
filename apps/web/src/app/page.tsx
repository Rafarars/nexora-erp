import { getEnv } from "@/env";

// En cada peticion: el estado no puede servirse cacheado.
export const dynamic = "force-dynamic";

type HealthResponse = {
  status: string;
  database: { status: string; latencyMs?: number };
};

type HealthResult =
  | { reachable: true; httpStatus: number; body: HealthResponse }
  | { reachable: false; error: string };

async function fetchHealth(): Promise<HealthResult> {
  const { API_URL } = getEnv();

  try {
    const response = await fetch(`${API_URL}/health`, {
      cache: "no-store",
    });
    return {
      reachable: true,
      httpStatus: response.status,
      body: (await response.json()) as HealthResponse,
    };
  } catch (error) {
    // Ni siquiera respondio: apagada o URL incorrecta.
    return {
      reachable: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function StatusDot({ healthy }: { healthy: boolean }) {
  return (
    <span
      className={`inline-block size-2.5 rounded-full ${
        healthy ? "bg-emerald-500" : "bg-red-500"
      }`}
      aria-hidden
    />
  );
}

function StatusRow({
  label,
  value,
  healthy,
  testId,
}: {
  label: string;
  value: string;
  healthy: boolean;
  testId: string;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      <span className="text-sm text-black/60 dark:text-white/60">{label}</span>
      <span
        className="flex items-center gap-2 font-mono text-sm"
        data-testid={testId}
      >
        <StatusDot healthy={healthy} />
        {value}
      </span>
    </div>
  );
}

export default async function Home() {
  const health = await fetchHealth();

  const apiHealthy = health.reachable && health.httpStatus === 200;
  const databaseHealthy =
    health.reachable && health.body.database?.status === "up";
  const systemHealthy = apiHealthy && databaseHealthy;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <section className="w-full max-w-md rounded-xl border border-black/10 p-8 dark:border-white/15">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Nexora ERP</h1>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            Estado del sistema
          </p>
        </header>

        <div
          className="divide-y divide-black/10 dark:divide-white/10"
          data-testid="system-status"
          data-healthy={systemHealthy}
        >
          <StatusRow
            label="API"
            value={
              health.reachable ? `HTTP ${health.httpStatus}` : "sin respuesta"
            }
            healthy={apiHealthy}
            testId="api-status"
          />
          <StatusRow
            label="Base de datos"
            value={health.reachable ? health.body.database.status : "desconocido"}
            healthy={databaseHealthy}
            testId="database-status"
          />
          <StatusRow
            label="Latencia"
            value={
              health.reachable && health.body.database.latencyMs !== undefined
                ? `${health.body.database.latencyMs} ms`
                : "—"
            }
            healthy={databaseHealthy}
            testId="database-latency"
          />
        </div>

        {!health.reachable && (
          <p
            className="mt-6 rounded-lg bg-red-500/10 p-3 font-mono text-xs text-red-700 dark:text-red-400"
            data-testid="api-error"
          >
            {health.error}
          </p>
        )}
      </section>
    </main>
  );
}
