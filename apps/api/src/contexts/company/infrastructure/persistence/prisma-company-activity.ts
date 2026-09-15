import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { CompanyActivity } from '../../domain/settings/policy/company-activity.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';

// Pregunta a las tablas de inventario, compras, ventas y cobranza sin importar esos contextos. Una
// factura nace emitida: cualquiera cuenta. Del resto, lo que ya no es borrador.
@Injectable()
export class PrismaCompanyActivity implements CompanyActivity {
  constructor(private readonly prisma: PrismaService) {}

  async hasConfirmedDocuments(tenantId: TenantId): Promise<boolean> {
    const tenant = tenantId.value;
    const where = { tenantId: tenant, status: { not: 'draft' as const } };
    const select = { id: true } as const;

    const found = await Promise.all([
      this.prisma.adjustment.findFirst({ where, select }),
      this.prisma.purchaseOrder.findFirst({ where, select }),
      this.prisma.goodsReceipt.findFirst({ where, select }),
      this.prisma.salesOrder.findFirst({ where, select }),
      this.prisma.dispatch.findFirst({ where, select }),
      this.prisma.customerPayment.findFirst({ where, select }),
      this.prisma.invoice.findFirst({ where: { tenantId: tenant }, select }),
    ]);

    return found.some((row) => row !== null);
  }
}
