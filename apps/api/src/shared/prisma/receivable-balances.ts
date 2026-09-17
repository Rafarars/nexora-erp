import type { TransactionClient } from './document-stock-posting.js';

export const RECEIVABLE_BALANCES = Symbol('ReceivableBalances');

// Lenguaje publicado por cuentas por cobrar para ventas. Los cobros y lo que aplican a cada
// factura son de cuentas por cobrar; ventas los necesita para emitir a credito y para anular una
// factura, dentro de su propia transaccion.
export interface CustomerExposure {
  // Lo que el cliente debe de sus facturas emitidas, descontando los cobros confirmados, en la
  // moneda de la empresa, con cada factura redondeada a sus decimales.
  openBalance: number;
  // Si alguna factura con saldo ya paso su vencimiento.
  hasOverdue: boolean;
}

export interface ReceivableBalances {
  // Bloquea la fila del cliente: dos facturas a credito del mismo cliente van en fila y la
  // segunda ve el saldo con la primera.
  lockCustomer(tx: TransactionClient, tenantId: string, customerId: string, today: string, decimals: number): Promise<CustomerExposure>;
  // Sin bloqueo, para rechazar pronto.
  exposure(db: TransactionClient, tenantId: string, customerId: string, today: string, decimals: number): Promise<CustomerExposure>;
  // Lo aplicado a una factura por cobros confirmados. Quien llama ya bloqueo la factura.
  paidOf(tx: TransactionClient, tenantId: string, invoiceId: string): Promise<number>;
}
