import { describe, expect, it } from 'vitest';
import { InvalidItemTypeError } from '../errors/invalid-values.errors.js';
import { itemTypeOf } from './item-type.js';

describe('itemTypeOf', () => {
  it.each(['inventoried', 'service'])('accepts %s', (value) => {
    expect(itemTypeOf(value)).toBe(value);
  });

  // Serializado y no inventariado quedaron fuera del alcance: no se aceptan a medias.
  it.each(['serialized', 'non_inventoried', 'Service', ''])('rejects %j', (value) => {
    expect(() => itemTypeOf(value)).toThrow(InvalidItemTypeError);
  });
});
