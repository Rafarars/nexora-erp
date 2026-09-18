import { describe, expect, it } from 'vitest';
import { formatNumber, parseDecimal, selectableOptions } from './catalog';

describe('selectableOptions', () => {
  const records = [
    { id: 'a', code: 'CAT000001', name: 'Activa', isActive: true },
    { id: 'b', code: 'CAT000002', name: 'Inactiva', isActive: false },
  ];

  it('offers only active records for a new item', () => {
    expect(selectableOptions(records).map((record) => record.id)).toEqual(['a']);
  });

  // Si no, abrir para editar un articulo con categoria desactivada la cambiaria sola.
  it('keeps the inactive record the item already has', () => {
    expect(selectableOptions(records, 'b').map((record) => record.id)).toEqual(['a', 'b']);
  });
});

describe('parseDecimal', () => {
  it.each([
    ['16', 16],
    ['8,5', 8.5],
    ['8.5', 8.5],
    [' 24 ', 24],
    ['0', 0],
  ])('reads %j as %d', (text, expected) => {
    expect(parseDecimal(text)).toBe(expected);
  });

  // Lo que no es un numero no se adivina: lo rechaza la API senalando el campo.
  it.each(['', '16%', 'doce', '1.000,5', '1,2,3'])('does not guess %j', (text) => {
    expect(parseDecimal(text)).toBeNaN();
  });
});

describe('formatNumber', () => {
  // Ocho decimales: los que admite el factor de conversion (una pieza de una docena es 0,08333333).
  it('uses a decimal comma and at most eight decimals', () => {
    expect(formatNumber(12.345678912)).toBe('12,34567891');
    expect(formatNumber(0.08333333)).toBe('0,08333333');
  });

  // Un factor de 12 345 que se mostrara como "12.345" no se podria volver a guardar.
  it('does not group thousands, so what it writes can be read back', () => {
    expect(formatNumber(12345.5)).toBe('12345,5');
    expect(parseDecimal(formatNumber(12345.5))).toBe(12345.5);
  });
});
