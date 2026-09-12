'use client';

import Link from 'next/link';
import { useState } from 'react';
import { logout } from '@/app/(app)/actions';

// Al pie de la barra lateral, no arriba: la cuenta personal no es una seccion del
// sistema, y mezclarla con los modulos fue justo lo que habia que arreglar.
export function AccountMenu({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      {open ? (
        <div
          className="border-line bg-background absolute bottom-full left-0 mb-2 w-full rounded-md border p-1 shadow-lg"
          data-testid="account-menu"
        >
          <Link
            href="/perfil"
            onClick={() => setOpen(false)}
            data-testid="account-profile"
            className="hover:bg-surface block rounded px-3 py-2 text-sm"
          >
            Perfil
          </Link>

          <form action={logout}>
            <button
              type="submit"
              data-testid="logout"
              className="hover:bg-surface block w-full rounded px-3 py-2 text-left text-sm"
            >
              Salir
            </button>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        data-testid="account-button"
        className="hover:bg-surface flex w-full items-center gap-2 rounded-md px-3 py-2 text-left"
      >
        <span className="bg-surface border-line flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium uppercase">
          {name.slice(0, 1)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm" data-testid="current-user">
            {name}
          </span>
          <span className="text-muted block truncate text-xs">{email}</span>
        </span>
        <span className="text-muted text-xs" aria-hidden>
          {open ? '▾' : '▴'}
        </span>
      </button>
    </div>
  );
}
