import { DocumentAuthors } from '../../domain/documents/document-authors.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// Las personas de cada empresa, sembradas a mano. Filtra por empresa igual que la base: un
// doble mas permisivo daria por buena una consulta que PostgreSQL deja vacia.
export class InMemoryDocumentAuthors implements DocumentAuthors {
  constructor(private readonly people: { tenantId: string; id: string; name: string }[] = []) {}

  async namesOf(tenantId: TenantId, userIds: string[]): Promise<Map<string, string>> {
    return new Map(
      this.people
        .filter((person) => person.tenantId === tenantId.value && userIds.includes(person.id))
        .map((person) => [person.id, person.name]),
    );
  }
}
