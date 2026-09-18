import type { DocumentCurrency } from '../../company/domain/company';
import { formatQuantity } from '../../inventory/domain/inventory';

export type OrderStatus = 'draft' | 'confirmed' | 'partially_dispatched' | 'dispatched' | 'cancelled';
export type DispatchStatus = 'draft' | 'confirmed' | 'cancelled';
export type InvoiceStatus = 'issued' | 'cancelled';

export interface Customer {
  id: string;
  code: string;
  name: string;
  fiscalId: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  paymentTermDays: number;
  creditLimit: number | null;
  // Con que lista se le cotiza; nula, la lista por defecto de la empresa.
  priceListId: string | null;
  isActive: boolean;
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
  unitPrice: number;
  // Lo que sugirio la lista. Distinto de `unitPrice`, se pacto otro precio a mano.
  listPrice: number;
  // Si la linea sale de una bodega. Un servicio no: ni se reserva ni se despacha.
  movesStock: boolean;
  // Lo que ya se facturo de la linea. No mide lo mismo que lo despachado.
  invoicedQuantity: number;
  taxRate: number;
  dispatchedQuantity: number;
  pendingQuantity: number;
  subtotal: number;
}

export interface SalesOrder extends DocumentCurrency {
  id: string;
  code: string;
  customer: { id: string; name: string };
  warehouse: { id: string; name: string };
  date: string;
  notes: string | null;
  priceList: { id: string; name: string } | null;
  status: OrderStatus;
  totals: { subtotal: number; tax: number; total: number };
  lines: OrderLine[];
}

export interface DispatchLine {
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
}

export interface Dispatch {
  id: string;
  code: string;
  order: { id: string; code: string };
  customer: { id: string; name: string };
  warehouse: { id: string; name: string };
  date: string;
  notes: string | null;
  status: DispatchStatus;
  invoice: { id: string; code: string } | null;
  lines: DispatchLine[];
}

export interface Invoice extends DocumentCurrency {
  id: string;
  code: string;
  customer: { id: string; name: string };
  // Nulo cuando la factura solo cobra servicios: no hubo despacho del que nacer.
  dispatch: { id: string; code: string } | null;
  order: { id: string; code: string };
  issueDate: string;
  dueDate: string;
  notes: string | null;
  status: InvoiceStatus;
  subtotal: number;
  tax: number;
  total: number;
  // A la tasa de emision; null en las facturas anteriores a las tasas.
  subtotalVes: number | null;
  taxVes: number | null;
  totalVes: number | null;
  lines: { lineNumber: number; itemId: string; sku: string; itemName: string; unitAbbreviation: string; quantity: number; unitPrice: number; taxRate: number; subtotal: number; tax: number }[];
}

export interface Availability {
  item: { id: string; sku: string; name: string; baseUnit: string };
  warehouse: { id: string; name: string };
  onHand: number;
  reserved: number;
  available: number;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: 'Borrador',
  confirmed: 'Confirmado',
  partially_dispatched: 'Despachado en parte',
  dispatched: 'Despachado',
  cancelled: 'Anulado',
};

export const DISPATCH_STATUS_LABELS: Record<DispatchStatus, string> = { draft: 'Borrador', confirmed: 'Confirmado', cancelled: 'Anulado' };

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = { issued: 'Emitida', cancelled: 'Anulada' };

// Lo que la interfaz ofrece en cada estado; la API lo vuelve a comprobar. Un pedido despachado
// en parte no se anula: primero se anulan sus despachos.
export function orderActions(
  order: Pick<SalesOrder, 'status' | 'lines'>,
): { edit: boolean; confirm: boolean; cancel: boolean; dispatch: boolean; invoice: boolean } {
  const goods = order.lines.some((line) => line.movesStock);
  const confirmed = order.status === 'confirmed' || order.status === 'dispatched';
  // Anular no depende del estado sino de los hechos, como en el servidor: un pedido de solo
  // servicios figura como despachado sin tener un solo despacho, y aun asi se puede anular.
  const touched = order.lines.some((line) => line.dispatchedQuantity > 0 || line.invoicedQuantity > 0);

  return {
    edit: order.status === 'draft',
    confirm: order.status === 'draft',
    cancel: order.status !== 'cancelled' && !touched,
    dispatch: goods && (order.status === 'confirmed' || order.status === 'partially_dispatched'),
    // Un pedido sin mercancia se factura directo: no hay despacho del que nacer. Lo que ya se
    // facturo no vuelve a ofrecerse.
    invoice: !goods && confirmed && order.lines.some((line) => line.quantity > line.invoicedQuantity),
  };
}

// Un despacho facturado solo se puede anular despues de anular su factura.
export function dispatchActions(dispatch: Pick<Dispatch, 'status' | 'invoice'>): { edit: boolean; confirm: boolean; cancel: boolean; invoice: boolean } {
  return {
    edit: dispatch.status === 'draft',
    confirm: dispatch.status === 'draft',
    cancel: dispatch.status === 'draft' || (dispatch.status === 'confirmed' && dispatch.invoice === null),
    invoice: dispatch.status === 'confirmed' && dispatch.invoice === null,
  };
}

export function summarizeOrderLines(lines: OrderLine[]): string {
  return lines
    .map((line) => {
      const sent = line.dispatchedQuantity > 0 ? ` (${formatQuantity(line.dispatchedQuantity)} despachadas)` : '';

      return `${formatQuantity(line.quantity)} ${line.unitAbbreviation} ${line.sku}${sent}`;
    })
    .join(' · ');
}

export function summarizeDispatchLines(lines: DispatchLine[]): string {
  return lines.map((line) => `${formatQuantity(line.quantity)} ${line.unitAbbreviation} ${line.sku}`).join(' · ');
}

// Las lineas que un despacho puede llevar: las que tienen algo pendiente y, al editar un
// borrador, las que ya lleva.
// Un servicio no sale de una bodega: no se ofrece para despachar, se cobra en la factura.
export function dispatchableLines(order: SalesOrder, dispatch: Dispatch | null): { line: OrderLine; quantity: number }[] {
  return order.lines
    .filter((line) => line.movesStock)
    .map((line) => ({ line, quantity: dispatch?.lines.find((d) => d.orderLineId === line.id)?.quantity ?? 0 }))
    .filter(({ line, quantity }) => line.pendingQuantity > 0 || quantity > 0);
}

export function paymentTermLabel(days: number): string {
  return days === 0 ? 'Contado' : `${days} días`;
}
