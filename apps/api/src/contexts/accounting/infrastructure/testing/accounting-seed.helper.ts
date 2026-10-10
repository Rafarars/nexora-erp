import { createHash } from 'node:crypto';
import type { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { DEFAULT_ACCOUNTS_CATALOG } from '../../domain/testing/default-accounts.seed.js';

export async function seedAccountingForTenant(prisma: PrismaService, tenantId: string): Promise<void> {
  const accountIdByKey = new Map<string, string>();
  const settingAccountIds: Record<string, string> = {};

  for (const def of DEFAULT_ACCOUNTS_CATALOG) {
    const hash = createHash('sha256').update(`${tenantId}:${def.code}`).digest('hex');
    const generatedId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;

    const existing = await prisma.account.findUnique({
      where: { tenantId_code: { tenantId, code: def.code } },
    });
    const id = existing?.id ?? generatedId;

    accountIdByKey.set(def.key, id);
    const parentId = def.parentKey ? accountIdByKey.get(def.parentKey) ?? null : null;

    await prisma.account.upsert({
      where: { tenantId_code: { tenantId, code: def.code } },
      create: {
        id,
        tenantId,
        code: def.code,
        name: def.name,
        type: def.type,
        acceptsEntries: def.acceptsEntries,
        parentId,
        isActive: true,
      },
      update: {
        name: def.name,
        type: def.type,
        acceptsEntries: def.acceptsEntries,
        parentId,
        isActive: true,
      },
    });

    if (def.isDefaultCompanySetting) {
      settingAccountIds[def.isDefaultCompanySetting] = id;
    }
  }

  await prisma.companySettings.upsert({
    where: { tenantId },
    create: {
      tenantId,
      baseCurrency: 'USD',
      timeZone: 'UTC',
      amountDecimals: 2,
      priceDecimals: 2,
      rateType: 'legal',
      updatedAt: new Date(),
      ...settingAccountIds,
    },
    update: settingAccountIds,
  });
}
