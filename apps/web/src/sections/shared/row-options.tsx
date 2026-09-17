'use client';

import { useEffect, useRef, useState } from 'react';

// Alto aproximado del menu mas largo, para decidir si abre hacia abajo.
const MENU_ROOM = 200;

// El menu "Opciones" de cada fila: las acciones sobre
// un registro viven juntas y no reparten columnas por la tabla. Se posiciona fijo junto al boton: dentro
// del contenedor con desplazamiento de la tabla, una tabla de pocas filas lo recortaba.
export function RowOptions({
  testId,
  children,
}: {
  testId: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [position, setPosition] = useState<React.CSSProperties | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const open = position !== null;
  const close = () => setPosition(null);

  // Junto a su boton, y hacia arriba cuando no cabe debajo.
  const place = () => {
    const rect = button.current?.getBoundingClientRect();

    if (!rect) return;

    const right = window.innerWidth - rect.right;

    setPosition(rect.bottom + MENU_ROOM > window.innerHeight ? { bottom: window.innerHeight - rect.top + 4, right } : { top: rect.bottom + 4, right });
  };

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) close();
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    // Esta fijo en la pantalla: si algo se desplaza, se recoloca en vez de quedarse atras.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  return (
    <div className="relative inline-block" ref={container}>
      <button
        type="button"
        aria-label="Opciones"
        aria-expanded={open}
        ref={button}
        onClick={() => (open ? close() : place())}
        data-testid={testId}
        className="border-line hover:bg-surface rounded-md border px-2 py-1 text-sm"
      >
        ⋮
      </button>

      {open ? (
        <div
          role="menu"
          style={position}
          className="border-line bg-background fixed z-50 w-56 rounded-md border p-1 shadow-lg"
        >
          {children(close)}
        </div>
      ) : null}
    </div>
  );
}
