import { startTransition } from 'react';
import type { FormEvent } from 'react';

// React reinicia un formulario con `action` al terminar, tambien cuando el servidor lo rechazo: se
// pierde lo elegido y un select controlado (la moneda) queda mostrando otra opcion que su estado.
// Enviarlo a mano deja el formulario como estaba para corregir y volver a guardar.
export function submitKeepingValues(action: (form: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    startTransition(() => action(form));
  };
}
