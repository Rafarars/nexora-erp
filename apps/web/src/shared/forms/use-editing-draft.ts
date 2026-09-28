'use client';

import { useCallback, useState } from 'react';
import {
  type IdExtractor,
  editingDraftKey,
  resolveEditingDraft,
} from '@/modules/shared/editing-draft';

const defaultGetId = <T>(item: T): string => (item as unknown as { id: string }).id;

// Hook para paneles de edicion: no guarda una copia congelada de la fila, sino su id y la
// copia de apertura como respaldo. Si el servidor revalida y las props traen datos nuevos,
// `editing` toma la version fresca de inmediato y la clave del formulario cambia, remontando
// los campos no controlados sin arrastrar datos viejos.
export function useEditingDraft<T>(
  items: readonly T[],
  getId: IdExtractor<T> = defaultGetId,
) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<T | null>(null);

  const editing = resolveEditingDraft(items, editingId, snapshot, getId);

  const setEditing = useCallback(
    (item: T | null) => {
      if (item) {
        setEditingId(getId(item));
        setSnapshot(item);
      } else {
        setEditingId(null);
        setSnapshot(null);
      }
    },
    [getId],
  );

  const draftKey = useCallback(
    (prefix = 'form') => editingDraftKey(prefix, editing, getId),
    [editing, getId],
  );

  return {
    editing,
    setEditing,
    draftKey,
  };
}
