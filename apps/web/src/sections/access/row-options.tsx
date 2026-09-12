'use client';

import { useEffect, useRef, useState } from 'react';

// El menu "Opciones" de cada fila, como en los listados de Flexio: las acciones sobre
// un registro viven juntas y no reparten columnas por la tabla.
export function RowOptions({
  testId,
  children,
}: {
  testId: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);

    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  return (
    <div className="relative inline-block" ref={container}>
      <button
        type="button"
        aria-label="Opciones"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        data-testid={testId}
        className="border-line hover:bg-surface rounded-md border px-2 py-1 text-sm"
      >
        ⋮
      </button>

      {open ? (
        <div
          role="menu"
          className="border-line bg-background absolute right-0 z-20 mt-1 w-56 rounded-md border p-1 shadow-lg"
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}
