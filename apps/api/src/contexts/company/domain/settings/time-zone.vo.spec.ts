import { describe, expect, it } from 'vitest';
import { InvalidTimeZoneError } from '../errors/company.errors.js';
import { TimeZone } from './time-zone.vo.js';

describe('TimeZone', () => {
  it.each(['America/Caracas', 'Europe/Madrid', 'UTC'])('accepts %s', (zone) => {
    expect(TimeZone.of(zone).value).toBe(zone);
  });

  it.each(['Marte/Olympus', '+04:00', 'GMT-4 ', '', 'America/'])('rejects %j', (zone) => {
    expect(() => TimeZone.of(zone)).toThrow();
  });

  it('says the unknown zone is what failed', () => {
    expect(() => TimeZone.of('Marte/Olympus')).toThrow(InvalidTimeZoneError);
  });

  // El caso que corrige: de noche en Caracas, en UTC ya es el dia siguiente.
  it('tells the calendar day of the company, not the UTC one', () => {
    const night = new Date('2026-09-16T01:30:00.000Z');

    expect(TimeZone.of('America/Caracas').todayAt(night)).toBe('2026-09-15');
    expect(TimeZone.of('UTC').todayAt(night)).toBe('2026-09-16');
  });
});
