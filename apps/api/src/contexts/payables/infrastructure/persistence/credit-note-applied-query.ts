export async function queryAppliedPaymentsSum(
  prisma: { supplierPayment: { aggregate: (args: any) => Promise<any> } },
  tenantId: string,
  creditSourceId: string,
  excludePaymentId?: string | null,
): Promise<number> {
  const result = await prisma.supplierPayment.aggregate({
    where: {
      tenantId,
      creditSourceId,
      status: 'confirmed',
      ...(excludePaymentId ? { id: { not: excludePaymentId } } : {}),
    },
    _sum: { amount: true },
  });

  return result._sum.amount ? result._sum.amount.toNumber() : 0;
}

export async function queryAppliedAmountsByNotes(
  prisma: { supplierPayment: { groupBy: (args: any) => Promise<any[]> } },
  tenantId: string,
  noteIds: string[],
  excludePaymentId?: string | null,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  for (const id of noteIds) {
    map.set(id, 0);
  }
  if (noteIds.length === 0) return map;

  const rows = await prisma.supplierPayment.groupBy({
    by: ['creditSourceId'],
    where: {
      tenantId,
      creditSourceId: { in: noteIds },
      status: 'confirmed',
      ...(excludePaymentId ? { id: { not: excludePaymentId } } : {}),
    },
    _sum: { amount: true },
  });

  for (const row of rows) {
    if (row.creditSourceId && row._sum.amount) {
      map.set(row.creditSourceId, row._sum.amount.toNumber());
    }
  }

  return map;
}
