import { InvalidItemTypeError } from '../errors/invalid-values.errors.js';

// `inventoried` tendra existencia y kardex desde el H3; `service` se compra y se vende
// pero nunca tiene stock.
export const ITEM_TYPES = ['inventoried', 'service'] as const;

export type ItemType = (typeof ITEM_TYPES)[number];

export function itemTypeOf(value: string): ItemType {
  const type = ITEM_TYPES.find((candidate) => candidate === value);

  if (!type) {
    throw new InvalidItemTypeError(value);
  }

  return type;
}
