import { redirect } from 'next/navigation';

// La administracion no tiene portada propia: se entra por la primera seccion.
export default function AdministrationIndexPage() {
  redirect('/administracion/usuarios');
}
