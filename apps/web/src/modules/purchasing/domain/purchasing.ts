import { formatQuantity } from '../../inventory/domain/inventory';

export type OrderStatus = 'draft' | 'confirmed' | 'partially_received' | 'received' | 'cancelled';
export type ReceiptStatus = 'draft' | 'confirmed' | 'cancelled';

export interface Supplier {
  id: string;
  code: string;
  name: string;
  fiscalId: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  paymentTermDays: number;
  isActive: boolean;
}

// La moneda de un documento y las tasas que congelo (bolivares por 1 unidad). Sin tasas, es anterior
// al multimoneda y esta en la moneda de la empresa.
export interface DocumentCurrency {
  currency: string;
  exchangeRate: number | null;
  baseCurrency: string;
  baseExchangeRate: number | null;
  manualExchangeRate: boolean;
}

export interface OrderLine {
  id: string;
  lineNumber: number;
  itemId: string;
  sku: string;
  itemName: string;
  unitId: string;
  unitAbbreviation: string;
  quantity: number;
  baseQuantity: number;
  unitCost: number;
  taxRate: number;
  receivedQuantity: number;
  pendingQuantity: number;
  subtotal: number;
}

export interface PurchaseOrder extends DocumentCurrency {
  id: string;
  code: string;
  supplier: { id: string; name: string };
  warehouse: { id: string; name: string };
  date: string;
  expectedDate: string | null;
  notes: string | null;
  status: OrderStatus;
  totals: { subtotal: number; tax: number; total: number };
  lines: OrderLine[];
}

export interface ReceiptLine {
  id: string;
  lineNumber: number;
  orderLineId: string;
  itemId: string;
  sku: string;
  itemName: string;
  unitId: string;
  unitAbbreviation: string;
  quantity: number;
  baseQuantity: number;
  unitCost: number;
}

export interface GoodsReceipt extends DocumentCurrency {
  id: string;
  code: string;
  order: { id: string; code: string };
  supplier: { id: string; name: string };
  warehouse: { id: string; name: string };
  date: string;
  notes: string | null;
  status: ReceiptStatus;
  lines: ReceiptLine[];
}

export interface IncomingStock {
  item: { id: string; sku: string; name: string; baseUnit: string };
  warehouse: { id: string; name: string };
  quantity: number;
  orders: { id: string; code: string; expectedDate: string | null; pendingQuantity: number }[];
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: 'Borrador',
  confirmed: 'Confirmada',
  partially_received: 'Recibida en parte',
  received: 'Recibida',
  cancelled: 'Anulada',
};

export const RECEIPT_STATUS_LABELS: Record<ReceiptStatus, string> = {
  draft: 'Borrador',
  confirmed: 'Confirmada',
  cancelled: 'Anulada',
};

// Lo que la interfaz ofrece en cada estado. La API lo vuelve a comprobar; esto solo evita
// ofrecer un boton que acabaria en error. Anular una orden recibida en parte no se ofrece:
// primero hay que anular sus entradas.
export function orderActions(order: Pick<PurchaseOrder, 'status'>): { edit: boolean; confirm: boolean; cancel: boolean; receive: boolean } {
  return {
    edit: order.status === 'draft',
    confirm: order.status === 'draft',
    cancel: order.status === 'draft' || order.status === 'confirmed',
    receive: order.status === 'confirmed' || order.status === 'partially_received',
  };
}

export function receiptActions(receipt: Pick<GoodsReceipt, 'status'>): { edit: boolean; confirm: boolean; cancel: boolean } {
  return {
    edit: receipt.status === 'draft',
    confirm: receipt.status === 'draft',
    cancel: receipt.status !== 'cancelled',
  };
}

// "10 cja AGUA-500 (4 recibidas) · 20 kg DETERGENTE": una orden de un vistazo.
export function summarizeOrderLines(lines: OrderLine[]): string {
  return lines
    .map((line) => {
      const received = line.receivedQuantity > 0 ? ` (${formatQuantity(line.receivedQuantity)} recibidas)` : '';

      return `${formatQuantity(line.quantity)} ${line.unitAbbreviation} ${line.sku}${received}`;
    })
    .join(' · ');
}

export function summarizeReceiptLines(lines: ReceiptLine[]): string {
  return lines.map((line) => `${formatQuantity(line.quantity)} ${line.unitAbbreviation} ${line.sku}`).join(' · ');
}

// Las lineas que una entrada puede traer: las que tienen algo pendiente. Al editar un
// borrador tambien las que ya lleva, con lo que lleva.
export function receivableLines(order: PurchaseOrder, receipt: GoodsReceipt | null): { line: OrderLine; quantity: number }[] {
  return order.lines
    .map((line) => ({ line, quantity: receipt?.lines.find((r) => r.orderLineId === line.id)?.quantity ?? 0 }))
    .filter(({ line, quantity }) => line.pendingQuantity > 0 || quantity > 0);
}

export function formatAmount(value: number): string {
  return value.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
}

// Lo que vale un importe en bolivares con la tasa que congelo su documento; null si no tiene tasa.
export function inBolivars(amount: number, document: DocumentCurrency): number | null {
  if (document.currency === 'VES') return amount;
  if (document.exchangeRate === null) return null;

  return Math.round(amount * document.exchangeRate * 100) / 100;
}

// El formulario ofrece escribir la tasa solo si la empresa lo permite y la moneda no es la suya ni el
// bolivar: esas tienen la tasa del catalogo, o 1.
export function offersManualRate(currency: string, baseCurrency: string, allowsRateOverride: boolean): boolean {
  return allowsRateOverride && currency !== baseCurrency && currency !== 'VES';
}
