import { seedDemoData, startDatabase, waitForHealthyDatabase } from './infrastructure.js';

// Cada ejecucion garantiza su punto de partida en vez de confiar en como lo
// dejo la anterior: si una corrida previa murio con la base apagada, aqui se
// corrige sola.
export default async function globalSetup(): Promise<void> {
  startDatabase();
  await waitForHealthyDatabase();
  seedDemoData();
}
