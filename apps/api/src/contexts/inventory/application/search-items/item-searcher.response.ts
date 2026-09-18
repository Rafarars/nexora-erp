export interface ItemUnitResponse {
  unitId: string;
  name: string;
  abbreviation: string;
  conversionFactor: number;
  isBase: boolean;
}

export interface ItemResponse {
  id: string;
  code: string;
  sku: string;
  name: string;
  description: string | null;
  type: 'inventoried' | 'service';
  category: { id: string; name: string } | null;
  // El que se copia al vender y el que se copia al comprar; pueden ser el mismo o faltar.
  salesTax: { id: string; name: string; rate: number } | null;
  purchaseTax: { id: string; name: string; rate: number } | null;
  units: ItemUnitResponse[];
  isActive: boolean;
}

export interface ItemSearcherResponse {
  items: ItemResponse[];
}
