import { redirect } from 'next/navigation';

// La configuracion no tiene portada propia: se entra por la primera seccion.
export default function SettingsIndexPage() {
  redirect('/configuracion/usuarios');
}
