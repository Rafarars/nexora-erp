import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { DocumentAuthors } from '../../domain/documents/document-authors.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

@Injectable()
export class PrismaDocumentAuthors implements DocumentAuthors {
  constructor(private readonly prisma: PrismaService) {}

  async namesOf(tenantId: TenantId, userIds: string[]): Promise<Map<string, string>> {
    if (userIds.length === 0) return new Map();

    // Por la membresia: quien ya no pertenece a la empresa no se nombra en sus documentos.
    const rows = await this.prisma.user.findMany({
      where: { id: { in: userIds }, memberships: { some: { tenantId: tenantId.value } } },
      select: { id: true, name: true },
    });

    return new Map(rows.map((row) => [row.id, row.name]));
  }
}
