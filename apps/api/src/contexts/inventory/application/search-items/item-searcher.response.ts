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
  tax: { id: string; name: string; rate: number } | null;
  units: ItemUnitResponse[];
  isActive: boolean;
}

export interface ItemSearcherResponse {
  items: ItemResponse[];
}
