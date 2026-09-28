// Funciones puras para resolver el borrador en edicion y calcular su clave determinista.
// Sin React ni DOM: la logica es portable y se prueba sin montar componentes.

export interface Identifiable {
  id: string;
}

// Si el registro sigue en las filas actuales, toma la version fresca que traen las props;
// si desaparecio (otra pagina, filtro activo), preserva la copia del momento de abrir.
export function resolveEditingDraft<T extends Identifiable>(
  items: readonly T[],
  editingId: string | null,
  snapshot: T | null,
): T | null {
  if (!editingId) return null;
  const current = items.find((item) => item.id === editingId);
  return current ?? snapshot;
}

// Serializacion con claves ordenadas para que dos objetos con los mismos datos produzcan
// exactamente la misma cadena sin importar el orden de insercion de sus propiedades.
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

// Hash FNV-1a de 32 bits: determinista, compacto y sin dependencias externas.
function fnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

// Huella determinista basada exclusivamente en los datos del registro: sin Date.now() ni aleatorios.
export function computeDraftFingerprint(item: unknown): string {
  if (item === null || item === undefined) return '';
  return fnv1a(stableStringify(item));
}

// Clave para el formulario o campos con defaultValue: cambia cuando cambian los datos para remontarlos.
export function editingDraftKey(prefix: string, item: Identifiable | null): string {
  if (!item) return `${prefix}-new`;
  return `${prefix}-${item.id}-${computeDraftFingerprint(item)}`;
}
