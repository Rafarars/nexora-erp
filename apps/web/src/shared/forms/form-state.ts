// Lo que un formulario devuelve: un error que mostrar o la confirmacion de que se
// guardo. Vive aparte porque un archivo 'use server' solo puede exportar funciones
// async, y esto son un tipo y una constante.
export interface FormState {
  error: string | null;
  done: boolean;
}

export const emptyState: FormState = { error: null, done: false };
