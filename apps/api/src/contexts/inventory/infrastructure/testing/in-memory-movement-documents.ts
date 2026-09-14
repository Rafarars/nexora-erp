import { AdjustmentRepository } from '../../domain/adjustment/adjustment.repository.js';
import { DocumentRef, MovementDocuments } from '../../domain/documents/movement-documents.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// Los ajustes salen del almacen de la prueba; entradas y despachos se siembran a mano.
export class InMemoryMovementDocuments implements MovementDocuments {
  constructor(
    private readonly adjustments: AdjustmentRepository,
    private readonly others: { tenantId: string; id: string; code: string }[] = [],
  ) {}

  async codesOf(tenantId: TenantId, documents: DocumentRef[]): Promise<Map<string, string>> {
    const codes = new Map<string, string>();
    const adjustments = await this.adjustments.searchByTenant(tenantId);

    for (const document of documents) {
      const code =
        document.type === 'adjustment'
          ? adjustments.find((adjustment) => adjustment.id.value === document.id)?.code
          : this.others.find((other) => other.tenantId === tenantId.value && other.id === document.id)?.code;

      if (code) codes.set(document.id, code);
    }

    return codes;
  }
}
