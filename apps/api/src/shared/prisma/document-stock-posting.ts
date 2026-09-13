import type { TransactionClient } from '../../generated/prisma/internal/prismaNamespace.js';

export const DOCUMENT_STOCK_POSTING = Symbol('DocumentStockPosting');

export type { TransactionClient };

// Lenguaje publicado por el inventario para los documentos de otros contextos que mueven
// existencia. Lo implementa el inventario, que sigue siendo el unico que escribe kardex y
// existencias; quien lo usa no importa nada del inventario.
//
// Recibe la transaccion de quien llama a proposito: la entrada de mercancia cambia su
// estado, el de su orden y la existencia, y las tres cosas pasan juntas o no pasa ninguna.
// Por eso vive en la frontera de infraestructura y no en ningun dominio.
export interface DocumentStockEntry {
  lineId: string;
  itemId: string;
  warehouseId: string;
  // En unidad base, con hasta cuatro decimales.
  quantity: number;
  // Por unidad base, con hasta seis decimales.
  unitCost: number;
}

export interface StockDocument {
  type: 'receipt';
  id: string;
}

export interface DocumentStockPosting {
  // Bloquea las existencias en orden fijo y registra una entrada por linea.
  receive(tx: TransactionClient, tenantId: string, document: StockDocument, entries: DocumentStockEntry[], now: Date): Promise<void>;
  // Revierte todo lo que el documento escribio. Lanza InsufficientStockError si la
  // mercancia ya salio.
  reverse(tx: TransactionClient, tenantId: string, document: StockDocument, now: Date): Promise<void>;
}
