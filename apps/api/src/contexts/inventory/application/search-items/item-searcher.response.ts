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
  barcode: string | null;
  isPurchasable: boolean;
  isSellable: boolean;
  name: string;
  description: string | null;
  type: 'inventoried' | 'service';
  category: { id: string; name: string } | null;
  // El que se copia al vender y el que se copia al comprar; pueden ser el mismo o faltar.
  salesTax: { id: string; name: string; rate: number } | null;
  purchaseTax: { id: string; name: string; rate: number } | null;
  units: ItemUnitResponse[];
  // Cuanto se quiere tener en cada bodega; vacio, no se vigila.
  reorderRules: { warehouse: { id: string; name: string }; minQuantity: number; maxQuantity: number | null; reorderQuantity: number }[];
  // Lo que cuesta en cada lista, en la unidad base; vacio, no se sugiere precio.
  prices: { priceList: { id: string; name: string; currency: string }; price: number }[];
  // Piso de venta en la moneda de la empresa; nulo, no hay piso.
  minPrice: number | null;
  isActive: boolean;
}

export interface ItemSearcherResponse {
  items: ItemResponse[];
  // De la pagina: cuantos cumplen el filtro y donde empieza lo que se devuelve.
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
