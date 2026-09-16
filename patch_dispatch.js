const fs = require('fs');
let file = fs.readFileSync('apps/api/src/contexts/sales/domain/dispatch/dispatch.entity.ts', 'utf8');

file = file.replace(
  'export interface DispatchDetails {\n  date: SalesDate;\n  notes: string | null;\n  lines: DispatchLine[];\n}',
  `export interface DispatchDetails {\n  date: SalesDate;\n  currency: DocumentCurrency;\n  notes: string | null;\n  lines: DispatchLine[];\n}`
);

file = file.replace(
  'export interface DispatchPrimitives {\n  id: string;\n  tenantId: string;\n  code: string;\n  orderId: string;\n  warehouseId: string;\n  dispatchDate: string;\n  notes: string | null;\n  status: DispatchStatus;\n  confirmedAt: Date | null;\n  cancelledAt: Date | null;\n  createdAt: Date;\n  updatedAt: Date;\n  lines: DispatchLinePrimitives[];\n}',
  `export interface DispatchPrimitives extends DocumentCurrencyPrimitives {\n  id: string;\n  tenantId: string;\n  code: string;\n  orderId: string;\n  warehouseId: string;\n  dispatchDate: string;\n  notes: string | null;\n  status: DispatchStatus;\n  confirmedAt: Date | null;\n  cancelledAt: Date | null;\n  createdAt: Date;\n  updatedAt: Date;\n  lines: DispatchLinePrimitives[];\n}`
);

file = file.replace(
  '  static create(\n    tenantId: TenantId,\n    id: DispatchId,\n    code: string,\n    orderId: SalesOrderId,\n    warehouseId: WarehouseRef,\n    details: DispatchDetails,\n    now: Date,\n  ): Dispatch {\n    if (details.lines.length === 0) throw new EmptyDispatchError(id.value);\n\n    return new Dispatch(tenantId, id, code, orderId, warehouseId, details, \'draft\', null, null, now, now);\n  }',
  `  static create(\n    tenantId: TenantId,\n    id: DispatchId,\n    code: string,\n    orderId: SalesOrderId,\n    warehouseId: WarehouseRef,\n    details: DispatchDetails,\n    now: Date,\n  ): Dispatch {\n    if (details.lines.length === 0) throw new EmptyDispatchError(id.value);\n\n    return new Dispatch(tenantId, id, code, orderId, warehouseId, details, \'draft\', null, null, now, now);\n  }\n\n  currency(): DocumentCurrency {\n    return this.details.currency;\n  }`
);

file = file.replace(
  '  static fromPrimitives(row: DispatchPrimitives): Dispatch {\n    return new Dispatch(\n      TenantId.of(row.tenantId),\n      DispatchId.of(row.id),\n      row.code,\n      SalesOrderId.of(row.orderId),\n      WarehouseRef.of(row.warehouseId),\n      {\n        date: SalesDate.of(row.dispatchDate),\n        notes: row.notes,\n        lines: row.lines.map(DispatchLine.fromPrimitives),\n      },\n      row.status,\n      row.confirmedAt,\n      row.cancelledAt,\n      row.createdAt,\n      row.updatedAt,\n    );\n  }',
  `  static fromPrimitives(row: DispatchPrimitives): Dispatch {\n    return new Dispatch(\n      TenantId.of(row.tenantId),\n      DispatchId.of(row.id),\n      row.code,\n      SalesOrderId.of(row.orderId),\n      WarehouseRef.of(row.warehouseId),\n      {\n        date: SalesDate.of(row.dispatchDate),\n        currency: DocumentCurrency.fromPrimitives(row),\n        notes: row.notes,\n        lines: row.lines.map(DispatchLine.fromPrimitives),\n      },\n      row.status,\n      row.confirmedAt,\n      row.cancelledAt,\n      row.createdAt,\n      row.updatedAt,\n    );\n  }`
);

file = file.replace(
  '  toPrimitives(): DispatchPrimitives {\n    const { date, notes, lines } = this.details;\n\n    return {\n      id: this.id.value,\n      tenantId: this.tenantId.value,\n      code: this.code,\n      orderId: this.orderId.value,\n      warehouseId: this.warehouseId.value,\n      dispatchDate: date.value,\n      notes,\n      status: this.status,\n      confirmedAt: this._confirmedAt,\n      cancelledAt: this._cancelledAt,\n      createdAt: this._createdAt,\n      updatedAt: this._updatedAt,\n      lines: lines.map((line) => line.toPrimitives()),\n    };\n  }',
  `  toPrimitives(): DispatchPrimitives {\n    const { date, currency, notes, lines } = this.details;\n\n    return {\n      id: this.id.value,\n      tenantId: this.tenantId.value,\n      code: this.code,\n      orderId: this.orderId.value,\n      warehouseId: this.warehouseId.value,\n      dispatchDate: date.value,\n      ...currency.toPrimitives(),\n      notes,\n      status: this.status,\n      confirmedAt: this._confirmedAt,\n      cancelledAt: this._cancelledAt,\n      createdAt: this._createdAt,\n      updatedAt: this._updatedAt,\n      lines: lines.map((line) => line.toPrimitives()),\n    };\n  }`
);

fs.writeFileSync('apps/api/src/contexts/sales/domain/dispatch/dispatch.entity.ts', file);
