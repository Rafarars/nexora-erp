import { Clock } from '../../../../shared/domain/ports/clock.js';

// Congela el tiempo: una prueba sobre fechas deja de depender del dia que se ejecute.
export class FixedClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return this.current;
  }

  travelTo(moment: Date): void {
    this.current = moment;
  }
}
