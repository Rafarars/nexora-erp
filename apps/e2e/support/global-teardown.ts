import { seedDemoData } from './infrastructure.js';

// Las pruebas crean personas y roles sobre la marcha. Sembrar tambien al TERMINAR
// deja la base como la encontraria quien abre el sistema despues, sin filas de prueba.
export default async function globalTeardown(): Promise<void> {
  seedDemoData();
}
