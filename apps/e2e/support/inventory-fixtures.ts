import type { APIRequestContext } from '@playwright/test';

const PASSWORD = 'Nexora-2026!';

// Del seed de Acme: la bodega Principal y las unidades.
export const ACME_INVENTORY = {
  mainWarehouse: 'e3000000-0000-4000-8000-000000000001',
  piece: 'e0000000-0000-4000-8000-000000000001',
  box: 'e0000000-0000-4000-8000-000000000002',
};

export const auth = (token: string) => ({ authorization: `Bearer ${token}` });

// Hoy para las empresas del seed, que trabajan en Caracas: desde las 20:00 el dia UTC ya es otro y
// las fechas que propone la API no coincidirian.
export function companyToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date());
}

export async function tokenFor(request: APIRequestContext, email: string, baseUrl = ''): Promise<string> {
  const response = await request.post(`${baseUrl}/api/v1/auth/login`, { data: { email, password: PASSWORD } });

  return (await response.json()).token;
}

// Un articulo propio por prueba: las pruebas corren en paralelo y comparten la base, y
// dos que movieran el stock del agua del seed se pisarian la una a la otra.
export async function aFreshItem(
  request: APIRequestContext,
  token: string,
  baseUrl = '',
): Promise<{ id: string; sku: string; name: string }> {
  const sku = `INV-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
  const name = `Artículo ${sku}`;

  await request.post(`${baseUrl}/api/v1/inventory/items`, {
    headers: auth(token),
    data: {
      sku,
      name,
      type: 'inventoried',
      units: [
        { unitId: ACME_INVENTORY.piece, conversionFactor: 1, isBase: true },
        { unitId: ACME_INVENTORY.box, conversionFactor: 24, isBase: false },
      ],
    },
  });

  // El listado va paginado: se busca por su SKU, que es unico.
  const { items } = await (await request.get(`${baseUrl}/api/v1/inventory/items?q=${sku}`, { headers: auth(token) })).json();

  return { ...items.find((item: { sku: string }) => item.sku === sku), sku, name };
}
