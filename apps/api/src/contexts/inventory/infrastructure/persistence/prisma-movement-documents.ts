import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { DocumentRef, MovementDocuments } from '../../domain/documents/movement-documents.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// Capa anticorrupcion para el kardex: lee los codigos de los ajustes y, sin importar nada de
// compras ni de ventas, los de sus entradas y despachos.
@Injectable()
export class PrismaMovementDocuments implements MovementDocuments {
  constructor(private readonly prisma: PrismaService) {}

  async codesOf(tenantId: TenantId, documents: DocumentRef[]): Promise<Map<string, string>> {
    const idsOf = (type: DocumentRef['type']) => [...new Set(documents.filter((d) => d.type === type).map((d) => d.id))];
    const [adjustments, receipts, dispatches] = await Promise.all([
      this.prisma.adjustment.findMany({ where: { tenantId: tenantId.value, id: { in: idsOf('adjustment') } }, select: { id: true, code: true } }),
      this.prisma.goodsReceipt.findMany({ where: { tenantId: tenantId.value, id: { in: idsOf('receipt') } }, select: { id: true, code: true } }),
      this.prisma.dispatch.findMany({ where: { tenantId: tenantId.value, id: { in: idsOf('dispatch') } }, select: { id: true, code: true } }),
    ]);

    return new Map([...adjustments, ...receipts, ...dispatches].map((row) => [row.id, row.code]));
  }
}
