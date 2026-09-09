// Se renderiza en cada peticion: el estado de salud nunca debe servirse cacheado.
export const dynamic = "force-dynamic";

type HealthResponse = {
  status: string;
  database: { status: string; latencyMs?: number };
};

type HealthResult =
  | { reachable: true; httpStatus: number; body: HealthResponse }
  | { reachable: false; error: string };

async function fetchHealth(): Promise<HealthResult> {
  const apiUrl = process.env.API_URL ?? "http://localhost:3001";

  try {
    const response = await fetch(`${apiUrl}/health`, { cache: "no-store" });
    return {
      reachable: true,
      httpStatus: response.status,
      body: (await response.json()) as HealthResponse,
    };
  } catch (error) {
    // La API ni siquiera respondio: esta apagada o la direccion es incorrecta.
    return {
      reachable: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

function Indicador({ activo }: { activo: boolean }) {
  return (
    <span
      className={`inline-block size-2.5 rounded-full ${
        activo ? "bg-emerald-500" : "bg-red-500"
      }`}
      aria-hidden
    />
  );
}

function Fila({
  etiqueta,
  valor,
  activo,
  testId,
}: {
  etiqueta: string;
  valor: string;
  activo: boolean;
  testId: string;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      <span className="text-sm text-black/60 dark:text-white/60">
        {etiqueta}
      </span>
      <span className="flex items-center gap-2 font-mono text-sm" data-testid={testId}>
        <Indicador activo={activo} />
        {valor}
      </span>
    </div>
  );
}

export default async function Home() {
  const health = await fetchHealth();

  const apiOperativa = health.reachable && health.httpStatus === 200;
  const baseOperativa =
    health.reachable && health.body.database?.status === "up";
  const todoOperativo = apiOperativa && baseOperativa;

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
          data-testid="estado-sistema"
          data-operativo={todoOperativo}
        >
          <Fila
            etiqueta="API"
            valor={
              health.reachable ? `HTTP ${health.httpStatus}` : "sin respuesta"
            }
            activo={apiOperativa}
            testId="estado-api"
          />
          <Fila
            etiqueta="Base de datos"
            valor={health.reachable ? health.body.database.status : "desconocido"}
            activo={baseOperativa}
            testId="estado-base-datos"
          />
          <Fila
            etiqueta="Latencia"
            valor={
              health.reachable && health.body.database.latencyMs !== undefined
                ? `${health.body.database.latencyMs} ms`
                : "—"
            }
            activo={baseOperativa}
            testId="latencia-base-datos"
          />
        </div>

        {!health.reachable && (
          <p
            className="mt-6 rounded-lg bg-red-500/10 p-3 font-mono text-xs text-red-700 dark:text-red-400"
            data-testid="error-api"
          >
            {health.error}
          </p>
        )}
      </section>
    </main>
  );
}
