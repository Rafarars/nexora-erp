import { Dispatch } from '../../dispatch/dispatch.entity.js';
import { SalesOrder } from '../../order/sales-order.entity.js';
import { Invoice } from '../invoice.entity.js';

// Emitir consume saldo del pedido: lo facturado sube en cada linea que entro a la factura, igual
// que confirmar un despacho sube lo despachado. Sin esta cuenta, un servicio se facturaria una vez
// por cada despacho del pedido.
export class InvoiceIssuance {
  apply(invoice: Invoice, order: SalesOrder, dispatch: Dispatch | null, now: Date): { invoice: Invoice; order: SalesOrder } {
    const dispatched = dispatch ? dispatch.lines().map((line) => ({ orderLineId: line.orderLineId, quantity: line.quantity })) : null;

    order.invoiceLines(
      order.linesToInvoice(dispatched).map(({ line, quantity }) => ({ orderLineId: line.id, quantity })),
      now,
    );

    return { invoice, order };
  }
}
