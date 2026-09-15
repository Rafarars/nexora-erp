import { StringValueObject } from '../../../../shared/domain/value-object.js';
import { InvalidTimeZoneError } from '../errors/company.errors.js';

// Zona horaria IANA (`America/Caracas`). De ella sale que dia es hoy para la empresa.
export class TimeZone extends StringValueObject {
  private constructor(value: string) {
    super(value.trim());

    if (!isKnownZone(this.value)) throw new InvalidTimeZoneError(value);
  }

  static of(value: string): TimeZone {
    return new TimeZone(value);
  }

  // El dia del calendario de la empresa en ese instante: a las 22:00 de Caracas sigue siendo hoy,
  // aunque en UTC ya sea manana.
  todayAt(now: Date): string {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: this.value, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const part = (type: string) => parts.find((candidate) => candidate.type === type)?.value ?? '';

    return `${part('year')}-${part('month')}-${part('day')}`;
  }
}

// Intl rechaza una zona desconocida al construir el formato. El patron descarta ademas los
// desplazamientos sueltos (`+04:00`), que no siguen los cambios de horario.
function isKnownZone(value: string): boolean {
  if (!/^[A-Za-z]+(\/[A-Za-z0-9_+-]+)*$/.test(value)) return false;

  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: value });

    return true;
  } catch {
    return false;
  }
}
