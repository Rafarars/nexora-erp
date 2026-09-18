'use server';

import { revalidatePath } from 'next/cache';
import { parseDecimal } from '@/modules/catalog/domain/catalog';
import { readableCatalogError } from '@/modules/catalog/domain/catalog-error';
import { catalogApi } from '@/shared/session/catalog-api';
import { requireSession } from '@/shared/session/current-session';
import type { FormState } from '@/shared/forms/form-state';

// Las acciones de servidor son la capa de aplicacion del frontend: leen el formulario,
// llaman al puerto, traducen el error y revalidan la pantalla.
const text = (form: FormData, name: string) => String(form.get(name) ?? '');
const optional = (form: FormData, name: string) => text(form, name).trim() || null;
const idOf = (form: FormData) => text(form, 'id') || null;

async function attempt(path: string, fallback: string, work: (token: string) => Promise<void>): Promise<FormState> {
  const { token } = await requireSession();

  try {
    await work(token);
  } catch (error) {
    return { error: readableCatalogError(error, fallback), done: false };
  }

  // Los articulos, en el inventario, muestran nombres de categorias, impuestos y unidades:
  // cambiar uno de esos se tiene que ver tambien alli.
  revalidatePath(path);
  revalidatePath('/inventario/articulos');

  return { error: null, done: true };
}

export async function saveCategory(_state: FormState, form: FormData): Promise<FormState> {
  return attempt('/catalogo/categorias', 'No se pudo guardar la categoría.', (token) =>
    catalogApi().saveCategory(token, idOf(form), { name: text(form, 'name'), description: optional(form, 'description') }),
  );
}

export async function changeCategoryStatus(_state: FormState, form: FormData): Promise<FormState> {
  return attempt('/catalogo/categorias', 'No se pudo cambiar el estado.', (token) =>
    catalogApi().changeCategoryStatus(token, text(form, 'id'), form.get('active') === 'true'),
  );
}

export async function saveUnit(_state: FormState, form: FormData): Promise<FormState> {
  return attempt('/catalogo/unidades', 'No se pudo guardar la unidad.', (token) =>
    catalogApi().saveUnit(token, idOf(form), { name: text(form, 'name'), abbreviation: text(form, 'abbreviation') }),
  );
}

export async function changeUnitStatus(_state: FormState, form: FormData): Promise<FormState> {
  return attempt('/catalogo/unidades', 'No se pudo cambiar el estado.', (token) =>
    catalogApi().changeUnitStatus(token, text(form, 'id'), form.get('active') === 'true'),
  );
}

export async function saveTax(_state: FormState, form: FormData): Promise<FormState> {
  return attempt('/catalogo/impuestos', 'No se pudo guardar el impuesto.', (token) =>
    catalogApi().saveTax(token, idOf(form), { name: text(form, 'name'), rate: parseDecimal(text(form, 'rate')) }),
  );
}

export async function changeTaxStatus(_state: FormState, form: FormData): Promise<FormState> {
  return attempt('/catalogo/impuestos', 'No se pudo cambiar el estado.', (token) =>
    catalogApi().changeTaxStatus(token, text(form, 'id'), form.get('active') === 'true'),
  );
}

export async function saveWarehouse(_state: FormState, form: FormData): Promise<FormState> {
  return attempt('/catalogo/bodegas', 'No se pudo guardar la bodega.', (token) =>
    catalogApi().saveWarehouse(token, idOf(form), { name: text(form, 'name'), address: optional(form, 'address') }),
  );
}

export async function changeWarehouseStatus(_state: FormState, form: FormData): Promise<FormState> {
  return attempt('/catalogo/bodegas', 'No se pudo cambiar el estado.', (token) =>
    catalogApi().changeWarehouseStatus(token, text(form, 'id'), form.get('active') === 'true'),
  );
}

export async function setDefaultWarehouse(_state: FormState, form: FormData): Promise<FormState> {
  return attempt('/catalogo/bodegas', 'No se pudo cambiar la bodega por defecto.', (token) =>
    catalogApi().setDefaultWarehouse(token, text(form, 'id')),
  );
}

export async function savePriceList(_state: FormState, form: FormData): Promise<FormState> {
  return attempt('/catalogo/listas-de-precio', 'No se pudo guardar la lista de precio.', (token) =>
    catalogApi().savePriceList(token, idOf(form), {
      name: text(form, 'name'),
      description: optional(form, 'description'),
      currency: text(form, 'currency'),
    }),
  );
}

export async function changePriceListStatus(_state: FormState, form: FormData): Promise<FormState> {
  return attempt('/catalogo/listas-de-precio', 'No se pudo cambiar el estado.', (token) =>
    catalogApi().changePriceListStatus(token, text(form, 'id'), form.get('active') === 'true'),
  );
}

export async function setDefaultPriceList(_state: FormState, form: FormData): Promise<FormState> {
  return attempt('/catalogo/listas-de-precio', 'No se pudo cambiar la lista por defecto.', (token) =>
    catalogApi().setDefaultPriceList(token, text(form, 'id')),
  );
}
