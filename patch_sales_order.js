const fs = require('fs');
let file = fs.readFileSync('apps/api/src/contexts/sales/domain/order/sales-order.entity.ts', 'utf8');

file = file.replace(
  'export interface SalesOrderDetails {\n  customerId: CustomerId;\n  warehouseId: WarehouseRef;\n  orderDate: SalesDate;\n  notes: string | null;\n  lines: SalesOrderLine[];\n}',
  `export interface SalesOrderDetails {\n  customerId: CustomerId;\n  warehouseId: WarehouseRef;\n  orderDate: SalesDate;\n  currency: DocumentCurrency;\n  notes: string | null;\n  lines: SalesOrderLine[];\n}`
);

file = file.replace(
  'export interface SalesOrderPrimitives {\n  id: string;\n  tenantId: string;\n  code: string;\n  customerId: string;\n  warehouseId: string;\n  orderDate: string;\n  notes: string | null;\n  status: SalesOrderStatus;\n  lines: SalesOrderLinePrimitives[];\n}',
  `export interface SalesOrderPrimitives extends DocumentCurrencyPrimitives {\n  id: string;\n  tenantId: string;\n  code: string;\n  customerId: string;\n  warehouseId: string;\n  orderDate: string;\n  notes: string | null;\n  status: SalesOrderStatus;\n  lines: SalesOrderLinePrimitives[];\n}`
);

file = file.replace(
  '  static create(\n    tenantId: TenantId,\n    id: SalesOrderId,\n    code: string,\n    details: SalesOrderDetails,\n    now: Date,\n  ): SalesOrder {\n    if (details.lines.length === 0) throw new EmptySalesOrderError(id.value);\n\n    return new SalesOrder(tenantId, id, code, details, \'draft\', null, null, now, now);\n  }',
  `  static create(\n    tenantId: TenantId,\n    id: SalesOrderId,\n    code: string,\n    details: SalesOrderDetails,\n    now: Date,\n  ): SalesOrder {\n    if (details.lines.length === 0) throw new EmptySalesOrderError(id.value);\n\n    return new SalesOrder(tenantId, id, code, details, \'draft\', null, null, now, now);\n  }\n\n  currency(): DocumentCurrency {\n    return this.details.currency;\n  }`
);

file = file.replace(
  '  static fromPrimitives(row: SalesOrderPrimitives): SalesOrder {\n    return new SalesOrder(\n      TenantId.of(row.tenantId),\n      SalesOrderId.of(row.id),\n      row.code,\n      {\n        customerId: CustomerId.of(row.customerId),\n        warehouseId: WarehouseRef.of(row.warehouseId),\n        orderDate: SalesDate.of(row.orderDate),\n        notes: row.notes,\n        lines: row.lines.map(SalesOrderLine.fromPrimitives),\n      },\n      row.status,\n      row.confirmedAt ? new Date(row.confirmedAt) : null,\n      row.cancelledAt ? new Date(row.cancelledAt) : null,\n      new Date(row.createdAt),\n      new Date(row.updatedAt),\n    );\n  }',
  `  static fromPrimitives(row: SalesOrderPrimitives): SalesOrder {\n    return new SalesOrder(\n      TenantId.of(row.tenantId),\n      SalesOrderId.of(row.id),\n      row.code,\n      {\n        customerId: CustomerId.of(row.customerId),\n        warehouseId: WarehouseRef.of(row.warehouseId),\n        orderDate: SalesDate.of(row.orderDate),\n        currency: DocumentCurrency.fromPrimitives(row),\n        notes: row.notes,\n        lines: row.lines.map(SalesOrderLine.fromPrimitives),\n      },\n      row.status,\n      row.confirmedAt ? new Date(row.confirmedAt) : null,\n      row.cancelledAt ? new Date(row.cancelledAt) : null,\n      new Date(row.createdAt),\n      new Date(row.updatedAt),\n    );\n  }`
);

file = file.replace(
  '  toPrimitives(): SalesOrderPrimitives & { createdAt: string; updatedAt: string } {\n    const { customerId, warehouseId, orderDate, notes, lines } = this.details;\n\n    return {\n      id: this.id.value,\n      tenantId: this.tenantId.value,\n      code: this.code,\n      customerId: customerId.value,\n      warehouseId: warehouseId.value,\n      orderDate: orderDate.value,\n      notes,\n      status: this.status,\n      lines: lines.map((line) => line.toPrimitives()),\n      confirmedAt: this._confirmedAt?.toISOString() ?? null,\n      cancelledAt: this._cancelledAt?.toISOString() ?? null,\n      createdAt: this._createdAt.toISOString(),\n      updatedAt: this._updatedAt.toISOString(),\n    };\n  }',
  `  toPrimitives(): SalesOrderPrimitives & { createdAt: string; updatedAt: string } {\n    const { customerId, warehouseId, orderDate, currency, notes, lines } = this.details;\n\n    return {\n      id: this.id.value,\n      tenantId: this.tenantId.value,\n      code: this.code,\n      customerId: customerId.value,\n      warehouseId: warehouseId.value,\n      orderDate: orderDate.value,\n      ...currency.toPrimitives(),\n      notes,\n      status: this.status,\n      lines: lines.map((line) => line.toPrimitives()),\n      confirmedAt: this._confirmedAt?.toISOString() ?? null,\n      cancelledAt: this._cancelledAt?.toISOString() ?? null,\n      createdAt: this._createdAt.toISOString(),\n      updatedAt: this._updatedAt.toISOString(),\n    };\n  }`
);

fs.writeFileSync('apps/api/src/contexts/sales/domain/order/sales-order.entity.ts', file);
