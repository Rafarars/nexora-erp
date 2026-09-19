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
  type: 'receipt' | 'dispatch';
  id: string;
  // El dia que el documento declara, "2026-08-10". El kardex lo guarda junto al instante en
  // que se publico: el saldo corre por el orden de publicacion, pero quien lee quiere ver la
  // fecha que escribio en el documento.
  date: string;
}

// Una salida: el costo no viaja, el inventario la valora al promedio vigente.
export type DocumentStockExit = Omit<DocumentStockEntry, 'unitCost'>;

export interface DocumentStockPosting {
  // Bloquea las existencias en orden fijo y registra una entrada por linea.
  receive(tx: TransactionClient, tenantId: string, document: StockDocument, entries: DocumentStockEntry[], now: Date): Promise<void>;
  // Bloquea las existencias en orden fijo y saca una salida por linea. Lanza
  // InsufficientStockError si alguna no alcanza.
  release(tx: TransactionClient, tenantId: string, document: StockDocument, exits: DocumentStockExit[], now: Date): Promise<void>;
  // Bloquea las filas de existencia en orden fijo y devuelve cuanto hay, en unidad base, por
  // `itemId|warehouseId`. Quien reserva existencia la compara con lo ya reservado dentro de la
  // misma transaccion, y dos reservas del mismo articulo esperan en fila.
  lockAvailable(tx: TransactionClient, tenantId: string, keys: [itemId: string, warehouseId: string][]): Promise<Map<string, number>>;
  // Revierte todo lo que el documento escribio. Lanza InsufficientStockError si la
  // mercancia ya salio.
  reverse(tx: TransactionClient, tenantId: string, document: StockDocument, now: Date): Promise<void>;
}
