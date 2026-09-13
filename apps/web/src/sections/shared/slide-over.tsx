'use client';

import { useEffect } from 'react';

// Panel lateral: la tabla sigue visible detras, asi que se ve el resultado sin
// recargar y una prueba puede comprobar el antes y el despues en la misma pantalla.
export function SlideOver({
  title,
  open,
  onClose,
  children,
  testId,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  testId: string;
}) {
  useEffect(() => {
    if (!open) return;

    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', close);

    return () => window.removeEventListener('keydown', close);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/30"
      />

      <aside
        role="dialog"
        aria-label={title}
        data-testid={testId}
        className="border-line bg-background relative z-10 flex h-full w-full max-w-md flex-col overflow-y-auto border-l p-6"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            data-testid={`${testId}-close`}
            className="text-muted text-sm"
          >
            Cerrar
          </button>
        </div>

        {children}
      </aside>
    </div>
  );
}
