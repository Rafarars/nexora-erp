import { AdjustmentRepository } from '../../domain/adjustment/adjustment.repository.js';
import { DocumentRef, MovementDocuments } from '../../domain/documents/movement-documents.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// Los ajustes salen del almacen de la prueba; las entradas de compras se siembran a mano.
export class InMemoryMovementDocuments implements MovementDocuments {
  constructor(
    private readonly adjustments: AdjustmentRepository,
    private readonly receipts: { tenantId: string; id: string; code: string }[] = [],
  ) {}

  async codesOf(tenantId: TenantId, documents: DocumentRef[]): Promise<Map<string, string>> {
    const codes = new Map<string, string>();
    const adjustments = await this.adjustments.searchByTenant(tenantId);

    for (const document of documents) {
      const code =
        document.type === 'adjustment'
          ? adjustments.find((adjustment) => adjustment.id.value === document.id)?.code
          : this.receipts.find((receipt) => receipt.tenantId === tenantId.value && receipt.id === document.id)?.code;

      if (code) codes.set(document.id, code);
    }

    return codes;
  }
}
