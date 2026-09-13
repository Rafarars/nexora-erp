import { describe, expect, it } from 'vitest';
import { CategoryName } from '../category/category-name.vo.js';
import { TextTooLongError, optionalText } from './bounded-text.vo.js';

describe('BoundedText', () => {
  it('trims the value', () => {
    expect(CategoryName.of('  Bebidas  ').value).toBe('Bebidas');
  });

  it('accepts exactly the maximum length', () => {
    expect(CategoryName.of('x'.repeat(150)).value).toHaveLength(150);
  });

  // Sin esto la base cortaria o rechazaria el valor con un error ilegible.
  it('rejects one character more than the column holds', () => {
    expect(() => CategoryName.of('x'.repeat(151))).toThrow(TextTooLongError);
  });

  it('rejects a value made only of spaces', () => {
    expect(() => CategoryName.of('   ')).toThrow(/cannot be empty/);
  });
});

describe('optionalText', () => {
  it.each([null, undefined, '', '   '])('stores %j as null', (value) => {
    expect(optionalText(value, 10, 'Notes')).toBeNull();
  });

  it('trims what it keeps', () => {
    expect(optionalText('  hola ', 10, 'Notes')).toBe('hola');
  });

  it('rejects a text longer than the maximum', () => {
    expect(() => optionalText('x'.repeat(11), 10, 'Notes')).toThrow(TextTooLongError);
  });
});
