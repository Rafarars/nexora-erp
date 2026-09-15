import { BusinessCalendar } from '../../domain/ports/business-calendar.js';
import { Clock } from '../../domain/ports/clock.js';

// Hoy es el dia UTC del reloj de la prueba: las pruebas de los documentos no dependen de la zona
// horaria de la empresa, que prueba su propio contexto.
export class ClockBusinessCalendar implements BusinessCalendar {
  constructor(private readonly clock: Clock) {}

  async today(): Promise<string> {
    return this.clock.now().toISOString().slice(0, 10);
  }
}
