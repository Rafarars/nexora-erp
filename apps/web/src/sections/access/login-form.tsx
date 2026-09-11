'use client';

import { useActionState } from 'react';
import { login } from '@/app/login/actions';
import type { LoginState } from '@/app/login/actions';

const initial: LoginState = { error: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initial);

  return (
    <form action={action} className="space-y-4" data-testid="login-form">
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          data-testid="login-email"
          className="border-line w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          data-testid="login-password"
          className="border-line w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
      </div>

      {state.error ? (
        <p
          role="alert"
          data-testid="login-error"
          className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        data-testid="login-submit"
        className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
