import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from '@node-rs/argon2';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { assertDisposableDatabase } from './disposable-database.js';
import { SYSTEM_PERMISSIONS } from '../src/contexts/access/domain/role/permissions.catalog.js';
import {
  calculatePurchasePriceDifference,
  effectiveRateToBase,
  type PriceDifferenceLineInput,
} from '../src/shared/domain/purchase-price-difference.js';

// Datos de demostracion para desarrollo y para la suite end-to-end. DOS empresas, no
// una: sin una segunda empresa no se puede probar que el aislamiento funciona, que es
// lo que este sistema tiene que demostrar.
//
// Y una tercera, Initech, que ninguna prueba lee salvo la que la usa: es para lo que
// solo existe una vez por empresa, como la bodega por defecto. Las pruebas corren en
// paralelo, y moverla en Acme haria fallar a otra que en ese instante comprueba cual es.
//
// Las contrasenas son conocidas a proposito, y por eso se niega a correr en
// produccion. Es idempotente: `make seed` dos veces deja el mismo resultado.
const ACME = '11111111-1111-4111-8111-111111111111';
const GLOBEX = '22222222-2222-4222-8222-222222222222';
const INITECH = '33333333-3333-4333-8333-333333333333';
// Empresa Wayne: tenant exclusivo para pruebas de cruce de reportes (p.ej. §3.8 en reports.api.spec.ts),
// donde se requiere verificar la igualdad exacta de saldos globales e individuales en el tablero,
// reportes y cuentas por pagar sin riesgo de interferencias ni mutaciones de configuración concurrentes.
const WAYNE = '55555555-5555-4555-8555-555555555555';

const ACME_ADMIN_ROLE = 'a0000000-0000-4000-8000-000000000001';
const ACME_VIEWER_ROLE = 'a0000000-0000-4000-8000-000000000002';
const GLOBEX_ADMIN_ROLE = 'b0000000-0000-4000-8000-000000000001';
const INITECH_ADMIN_ROLE = 'f0000000-0000-4000-8000-000000000001';
const VOLUME = '44444444-4444-4444-8444-444444444444';
const VOLUME_ADMIN_ROLE = 'f0000000-0000-4000-8000-000000000002';
const WAYNE_ADMIN_ROLE = 'f0000000-0000-4000-8000-000000000003';

const ANA = 'c0000000-0000-4000-8000-000000000001';
const BETO = 'c0000000-0000-4000-8000-000000000002';
const CONTADOR = 'c0000000-0000-4000-8000-000000000003';
const SUPERUSER = 'c0000000-0000-4000-8000-000000000004';
const DORA = 'c0000000-0000-4000-8000-000000000005';
const VERA = 'c0000000-0000-4000-8000-000000000006';
const BRUCE = 'c0000000-0000-4000-8000-000000000007';

const PASSWORD = process.env.SEED_PASSWORD ?? 'Nexora-2026!';

// Catalogo de ejemplo. Identificadores fijos por la misma razon que los de arriba: las
// pruebas de aislamiento atacan la categoria, la unidad o la bodega de Globex por su
// identificador, y tienen que saber cual es.
const CATALOG = {
  acme: {
    units: {
      piece: 'e0000000-0000-4000-8000-000000000001',
      box: 'e0000000-0000-4000-8000-000000000002',
      kilo: 'e0000000-0000-4000-8000-000000000003',
    },
    categories: { drinks: 'e1000000-0000-4000-8000-000000000001', cleaning: 'e1000000-0000-4000-8000-000000000002' },
    taxes: { vat: 'e2000000-0000-4000-8000-000000000001', exempt: 'e2000000-0000-4000-8000-000000000002' },
    warehouses: { main: 'e3000000-0000-4000-8000-000000000001', north: 'e3000000-0000-4000-8000-000000000002' },
    priceLists: { retail: 'e6000000-0000-4000-8000-000000000001', wholesale: 'e6000000-0000-4000-8000-000000000002' },
    items: {
      water: 'e4000000-0000-4000-8000-000000000001',
      detergent: 'e4000000-0000-4000-8000-000000000002',
      delivery: 'e4000000-0000-4000-8000-000000000003',
      soap: 'e4000000-0000-4000-8000-000000000004',
    },
  },
  globex: {
    units: {
      piece: 'e0000000-0000-4000-8000-000000000101',
      box: 'e0000000-0000-4000-8000-000000000102',
      kilo: 'e0000000-0000-4000-8000-000000000103',
    },
    categories: { parts: 'e1000000-0000-4000-8000-000000000101' },
    taxes: { vat: 'e2000000-0000-4000-8000-000000000101' },
    warehouses: { main: 'e3000000-0000-4000-8000-000000000101' },
    priceLists: { retail: 'e6000000-0000-4000-8000-000000000101' },
    items: { filter: 'e4000000-0000-4000-8000-000000000101' },
  },
  initech: {
    units: { piece: 'e0000000-0000-4000-8000-000000000201' },
    warehouses: { main: 'e3000000-0000-4000-8000-000000000201', second: 'e3000000-0000-4000-8000-000000000202' },
  },
};

// Lo que cada linea copia del maestro: renombrar un articulo no cambia los documentos ya escritos.
const ITEM_LABELS: Record<string, { itemSku: string; itemName: string }> = {
  'e4000000-0000-4000-8000-000000000001': { itemSku: 'AGUA-500', itemName: 'Agua mineral 500 ml' },
  'e4000000-0000-4000-8000-000000000002': { itemSku: 'DETERGENTE-1KG', itemName: 'Detergente en polvo 1 kg' },
  'e4000000-0000-4000-8000-000000000003': { itemSku: 'SERV-ENTREGA', itemName: 'Servicio de entrega' },
  'e4000000-0000-4000-8000-000000000004': { itemSku: 'JABON-500', itemName: 'Jabón líquido 500 ml' },
  'e4000000-0000-4000-8000-000000000101': { itemSku: 'FILTRO-ACEITE', itemName: 'Filtro de aceite' },
};

const labelsOf = (itemId: string) => ITEM_LABELS[itemId] ?? { itemSku: 'SIN-SKU', itemName: 'Sin nombre' };


// Compras de ejemplo. Globex tiene una orden confirmada, un borrador y una entrada en
// borrador porque la matriz de aislamiento los ataca desde Acme por su identificador.
const PURCHASING = {
  acme: {
    andina: 'e8000000-0000-4000-8000-000000000001',
    valle: 'e8000000-0000-4000-8000-000000000002',
    partialOrder: 'e9000000-0000-4000-8000-000000000001',
    draftOrder: 'e9000000-0000-4000-8000-000000000002',
    partialWater: 'ea000000-0000-4000-8000-000000000001',
    partialDetergent: 'ea000000-0000-4000-8000-000000000002',
    draftWater: 'ea000000-0000-4000-8000-000000000003',
    receipt: 'eb000000-0000-4000-8000-000000000001',
    receiptWater: 'ec000000-0000-4000-8000-000000000001',
    receiptMovement: 'e7000000-0000-4000-8000-000000000003',
    soapOrder: 'e9000000-0000-4000-8000-000000000003',
    soapOrderLine: 'ea000000-0000-4000-8000-000000000004',
    soapReceipt: 'eb000000-0000-4000-8000-000000000002',
    soapReceiptLine: 'ec000000-0000-4000-8000-000000000002',
    soapReceiptMovement: 'e7000000-0000-4000-8000-000000000006',
    purchaseReturn: 'f9000000-0000-4000-8000-000000000001',
    purchaseReturnLine: 'fa000000-0000-4000-8000-000000000001',
    purchaseReturnMovement: 'e7000000-0000-4000-8000-000000000007',
    serviceOrder: 'e9000000-0000-4000-8000-000000000004',
    serviceOrderLine: 'ea000000-0000-4000-8000-000000000005',
    northOrder: 'e9000000-0000-4000-8000-000000000005',
    northOrderLine: 'ea000000-0000-4000-8000-000000000006',
    northReceipt: 'eb000000-0000-4000-8000-000000000003',
    northReceiptLine: 'ec000000-0000-4000-8000-000000000003',
    northReceiptMovement: 'e7000000-0000-4000-8000-000000000014',
    interWarehouseWaterOrder: 'e9000000-0000-4000-8000-000000000006',
    interWarehouseWaterOrderLine: 'ea000000-0000-4000-8000-000000000007',
    interWarehouseWaterReceipt: 'eb000000-0000-4000-8000-000000000004',
    interWarehouseWaterReceiptLine: 'ec000000-0000-4000-8000-000000000004',
    interWarehouseWaterMovement: 'e7000000-0000-4000-8000-000000000015',
    interWarehouseNorthOrder: 'e9000000-0000-4000-8000-000000000007',
    interWarehouseNorthOrderLine: 'ea000000-0000-4000-8000-000000000008',
    interWarehouseNorthReceipt: 'eb000000-0000-4000-8000-000000000005',
    interWarehouseNorthReceiptLine: 'ec000000-0000-4000-8000-000000000005',
    interWarehouseNorthMovement: 'e7000000-0000-4000-8000-000000000016',
  },
  globex: {
    supplier: 'e8000000-0000-4000-8000-000000000101',
    confirmedOrder: 'e9000000-0000-4000-8000-000000000101',
    draftOrder: 'e9000000-0000-4000-8000-000000000102',
    confirmedFilter: 'ea000000-0000-4000-8000-000000000101',
    draftFilter: 'ea000000-0000-4000-8000-000000000102',
    receipt: 'eb000000-0000-4000-8000-000000000102',
    receiptFilter: 'ec000000-0000-4000-8000-000000000102',
    receiptMovement: 'e7000000-0000-4000-8000-000000000103',
    draftReceipt: 'eb000000-0000-4000-8000-000000000101',
    draftReceiptFilter: 'ec000000-0000-4000-8000-000000000101',
  },
};

// Ventas de ejemplo. Globex tiene un pedido despachado en parte con su despacho y factura, un
// despacho en borrador y un pedido en borrador: la matriz de aislamiento los ataca desde Acme.
const SALES = {
  acme: {
    delta: 'ed000000-0000-4000-8000-000000000001',
    corner: 'ed000000-0000-4000-8000-000000000002',
    farmacia: 'ed000000-0000-4000-8000-000000000003',
    partialOrder: 'ee000000-0000-4000-8000-000000000001',
    draftOrder: 'ee000000-0000-4000-8000-000000000002',
    partialWater: 'ef000000-0000-4000-8000-000000000001',
    partialDetergent: 'ef000000-0000-4000-8000-000000000002',
    draftWater: 'ef000000-0000-4000-8000-000000000003',
    dispatch: 'f1000000-0000-4000-8000-000000000001',
    dispatchWater: 'f2000000-0000-4000-8000-000000000001',
    invoice: 'f3000000-0000-4000-8000-000000000001',
    invoiceWater: 'f4000000-0000-4000-8000-000000000001',
    dispatchMovement: 'e7000000-0000-4000-8000-000000000004',
    payment: 'd3000000-0000-4000-8000-000000000001',
    paymentAllocation: 'd4000000-0000-4000-8000-000000000001',
    // H8 Caso 1: Devolucion sin nota
    cornerOrder: 'ee000000-0000-4000-8000-000000000003',
    cornerOrderSoap: 'ef000000-0000-4000-8000-000000000004',
    cornerDispatch: 'f1000000-0000-4000-8000-000000000002',
    cornerDispatchSoap: 'f2000000-0000-4000-8000-000000000002',
    cornerInvoice: 'f3000000-0000-4000-8000-000000000002',
    cornerInvoiceSoap: 'f4000000-0000-4000-8000-000000000002',
    cornerDispatchMovement: 'e7000000-0000-4000-8000-000000000008',
    salesReturn1: 'f7000000-0000-4000-8000-000000000001',
    salesReturn1Line: 'f7100000-0000-4000-8000-000000000001',
    salesReturn1Movement: 'e7000000-0000-4000-8000-000000000009',
    // H8 Caso 2: Nota sin devolucion
    farmaciaOrder1: 'ee000000-0000-4000-8000-000000000004',
    farmaciaOrder1Soap: 'ef000000-0000-4000-8000-000000000005',
    farmaciaDispatch1: 'f1000000-0000-4000-8000-000000000003',
    farmaciaDispatch1Soap: 'f2000000-0000-4000-8000-000000000003',
    farmaciaInvoice1: 'f3000000-0000-4000-8000-000000000003',
    farmaciaInvoice1Soap: 'f4000000-0000-4000-8000-000000000003',
    farmaciaDispatch1Movement: 'e7000000-0000-4000-8000-000000000010',
    creditNote1: 'f8000000-0000-4000-8000-000000000001',
    creditNote1Line: 'f8100000-0000-4000-8000-000000000001',
    issuePayment1: 'd3000000-0000-4000-8000-000000000002',
    issuePayment1Allocation: 'd4000000-0000-4000-8000-000000000002',
    // H8 Caso 3: Devolucion scrap con nota
    farmaciaOrder2: 'ee000000-0000-4000-8000-000000000005',
    farmaciaOrder2Soap: 'ef000000-0000-4000-8000-000000000006',
    farmaciaDispatch2: 'f1000000-0000-4000-8000-000000000004',
    farmaciaDispatch2Soap: 'f2000000-0000-4000-8000-000000000004',
    farmaciaInvoice2: 'f3000000-0000-4000-8000-000000000004',
    farmaciaInvoice2Soap: 'f4000000-0000-4000-8000-000000000004',
    farmaciaDispatch2Movement: 'e7000000-0000-4000-8000-000000000011',
    salesReturn2: 'f7000000-0000-4000-8000-000000000002',
    salesReturn2Line: 'f7100000-0000-4000-8000-000000000002',
    creditNote2: 'f8000000-0000-4000-8000-000000000002',
    creditNote2Line: 'f8100000-0000-4000-8000-000000000002',
    issuePayment2: 'd3000000-0000-4000-8000-000000000003',
    issuePayment2Allocation: 'd4000000-0000-4000-8000-000000000003',
    // H8 Caso 4: Nota con credito sobrante gastado desde Cobros
    farmaciaOrder3: 'ee000000-0000-4000-8000-000000000006',
    farmaciaOrder3Soap: 'ef000000-0000-4000-8000-000000000007',
    farmaciaOrder4: 'ee000000-0000-4000-8000-000000000007',
    farmaciaOrder4Soap: 'ef000000-0000-4000-8000-000000000008',
    farmaciaDispatch3: 'f1000000-0000-4000-8000-000000000005',
    farmaciaDispatch3Soap: 'f2000000-0000-4000-8000-000000000005',
    farmaciaDispatch4: 'f1000000-0000-4000-8000-000000000006',
    farmaciaDispatch4Soap: 'f2000000-0000-4000-8000-000000000006',
    farmaciaDispatch3Movement: 'e7000000-0000-4000-8000-000000000012',
    farmaciaDispatch4Movement: 'e7000000-0000-4000-8000-000000000013',
    farmaciaInvoice3: 'f3000000-0000-4000-8000-000000000005',
    farmaciaInvoice3Soap: 'f4000000-0000-4000-8000-000000000005',
    farmaciaInvoice4: 'f3000000-0000-4000-8000-000000000006',
    farmaciaInvoice4Soap: 'f4000000-0000-4000-8000-000000000006',
    creditNote3: 'f8000000-0000-4000-8000-000000000003',
    creditNote3Line: 'f8100000-0000-4000-8000-000000000003',
    issuePayment3: 'd3000000-0000-4000-8000-000000000004',
    issuePayment3Allocation: 'd4000000-0000-4000-8000-000000000004',
    appliedPayment: 'd3000000-0000-4000-8000-000000000005',
    appliedPaymentAllocation: 'd4000000-0000-4000-8000-000000000005',
  },
  globex: {
    customer: 'ed000000-0000-4000-8000-000000000101',
    partialOrder: 'ee000000-0000-4000-8000-000000000101',
    draftOrder: 'ee000000-0000-4000-8000-000000000102',
    partialFilter: 'ef000000-0000-4000-8000-000000000101',
    draftFilter: 'ef000000-0000-4000-8000-000000000102',
    dispatch: 'f1000000-0000-4000-8000-000000000101',
    dispatchFilter: 'f2000000-0000-4000-8000-000000000101',
    draftDispatch: 'f1000000-0000-4000-8000-000000000102',
    draftDispatchFilter: 'f2000000-0000-4000-8000-000000000102',
    invoice: 'f3000000-0000-4000-8000-000000000101',
    invoiceFilter: 'f4000000-0000-4000-8000-000000000101',
    dispatchMovement: 'e7000000-0000-4000-8000-000000000102',
    confirmedPayment: 'd3000000-0000-4000-8000-000000000101',
    draftPayment: 'd3000000-0000-4000-8000-000000000102',
    confirmedAllocation: 'd4000000-0000-4000-8000-000000000101',
    draftAllocation: 'd4000000-0000-4000-8000-000000000102',
  },
};

const INVENTORY = {
  acme: {
    opening: 'e5000000-0000-4000-8000-000000000001',
    breakage: 'e5000000-0000-4000-8000-000000000002',
    openingWater: 'e6000000-0000-4000-8000-000000000001',
    openingDetergent: 'e6000000-0000-4000-8000-000000000002',
    breakageWater: 'e6000000-0000-4000-8000-000000000003',
    waterMovement: 'e7000000-0000-4000-8000-000000000001',
    detergentMovement: 'e7000000-0000-4000-8000-000000000002',
    openingSoap: 'e6000000-0000-4000-8000-000000000004',
    soapMovement: 'e7000000-0000-4000-8000-000000000005',
  },
  globex: {
    opening: 'e5000000-0000-4000-8000-000000000101',
    draft: 'e5000000-0000-4000-8000-000000000102',
    openingFilter: 'e6000000-0000-4000-8000-000000000101',
    draftFilter: 'e6000000-0000-4000-8000-000000000102',
    filterMovement: 'e7000000-0000-4000-8000-000000000101',
  },
};

// Cuentas por pagar de ejemplo (H9): facturas de compra, notas de credito, pagos a proveedor
// y las revaluaciones de inventario asociadas.
const PAYABLES = {
  acme: {
    // Facturas de compra
    invoice1: 'fb000000-0000-4000-8000-000000000001',
    invoice1Line: 'fb100000-0000-4000-8000-000000000001',
    invoice2: 'fb000000-0000-4000-8000-000000000002',
    invoice2Line: 'fb100000-0000-4000-8000-000000000002',
    invoice3: 'fb000000-0000-4000-8000-000000000003',
    invoice3LineMain: 'fb100000-0000-4000-8000-000000000003',
    invoice3LineNorth: 'fb100000-0000-4000-8000-000000000004',
    invoice4: 'fb000000-0000-4000-8000-000000000004',
    invoice4LineService: 'fb100000-0000-4000-8000-000000000005',
    invoice4LineExpense: 'fb100000-0000-4000-8000-000000000006',
    invoice5: 'fb000000-0000-4000-8000-000000000005',
    invoice5Line: 'fb100000-0000-4000-8000-000000000007',

    // Pagos a proveedor
    payment1: 'fc000000-0000-4000-8000-000000000001',
    payment1Alloc1: 'fc100000-0000-4000-8000-000000000001',
    payment1Alloc2: 'fc100000-0000-4000-8000-000000000002',
    payment2: 'fc000000-0000-4000-8000-000000000002',
    payment2Alloc1: 'fc100000-0000-4000-8000-000000000003',
    payment3: 'fc000000-0000-4000-8000-000000000003',
    payment3Alloc1: 'fc100000-0000-4000-8000-000000000004',
    payment4: 'fc000000-0000-4000-8000-000000000004',
    payment4Alloc1: 'fc100000-0000-4000-8000-000000000005',

    // Notas de crédito de proveedor
    creditNote1: 'fd000000-0000-4000-8000-000000000001',
    creditNote1Line: 'fd100000-0000-4000-8000-000000000001',
    creditNote2: 'fd000000-0000-4000-8000-000000000002',
    creditNote2Line: 'fd100000-0000-4000-8000-000000000002',

    // Revaluaciones de inventario por compras
    adjFcp1: 'fe000000-0000-4000-8000-000000000001',
    adjFcp1Line: 'fe100000-0000-4000-8000-000000000001',
    adjFcp2: 'fe000000-0000-4000-8000-000000000002',
    adjFcp2Line: 'fe100000-0000-4000-8000-000000000002',
    adjFcp2OutMovement: 'e7000000-0000-4000-8000-000000000020',
    adjFcp2InMovement: 'e7000000-0000-4000-8000-000000000021',
    adjFcp3Main: 'fe000000-0000-4000-8000-000000000003',
    adjFcp3MainLine: 'fe100000-0000-4000-8000-000000000003',
    adjFcp3North: 'fe000000-0000-4000-8000-000000000004',
    adjFcp3NorthLine: 'fe100000-0000-4000-8000-000000000004',
    adjNcp1: 'fe000000-0000-4000-8000-000000000005',
    adjNcp1Line: 'fe100000-0000-4000-8000-000000000005',
  },
  globex: {
    confirmedInvoice: 'fb000000-0000-4000-8000-000000000102',
    confirmedInvoiceLine: 'fb100000-0000-4000-8000-000000000102',
    draftInvoice: 'fb000000-0000-4000-8000-000000000101',
    draftInvoiceLine: 'fb100000-0000-4000-8000-000000000101',

    confirmedPayment: 'fc000000-0000-4000-8000-000000000102',
    confirmedPaymentAlloc: 'fc100000-0000-4000-8000-000000000102',
    draftPayment: 'fc000000-0000-4000-8000-000000000101',
    draftPaymentAlloc: 'fc100000-0000-4000-8000-000000000101',

    confirmedCreditNote: 'fd000000-0000-4000-8000-000000000102',
    confirmedCreditNoteLine: 'fd100000-0000-4000-8000-000000000102',
    draftCreditNote: 'fd000000-0000-4000-8000-000000000101',
    draftCreditNoteLine: 'fd100000-0000-4000-8000-000000000101',
  },
};

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The demo seed must never run in production: its passwords are public.');
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required to seed.');
  }

  assertDisposableDatabase(connectionString);

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const passwordHash = await hash(PASSWORD);

  try {
    await removeLeftovers(prisma);
    await syncPermissions(prisma);
    await upsertTenants(prisma);
    await upsertCompanies(prisma);
    await upsertExchangeRates(prisma);
    await upsertRoles(prisma);
    await upsertUsers(prisma, passwordHash);
    await upsertMemberships(prisma);
    // El inventario apunta al catalogo: se vacia antes de limpiar el catalogo y se siembra
    // despues de sembrarlo.
    await removeInventory(prisma);
    await seedCatalog(prisma);
    await seedInventory(prisma);
    await seedPurchasing(prisma);
    await seedSales(prisma);
    await seedReceivables(prisma);
    await seedPayables(prisma);
    await seedVolume(prisma);
    await verifySeedIntegrity(prisma);

    console.log(
      '  semillas aplicadas: 5 empresas con sus datos y parametros, 6 roles, 7 personas, 9 membresias; ' +
        'catalogo: 7 unidades, 3 categorias, 3 impuestos, 5 bodegas, 3 listas de precio, 5 articulos con 8 precios; ' +
        'inventario: 7 ajustes (3 confirmados), 5 existencias; ' +
        'compras: 3 proveedores, 7 ordenes, 5 entradas, 1 devolucion; ' +
        'ventas: 4 clientes, 7 pedidos, 6 despachos, 6 facturas, 2 devoluciones; ' +
        'cuentas por cobrar: 3 notas de credito, 5 cobros (5 confirmados); ' +
        'cuentas por pagar: 7 facturas (6 confirmadas), 4 notas de credito (3 confirmadas), 6 pagos (5 confirmados); ' +
        'volumen: 50 clientes, 5000 facturas, 3000 cobros',
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Las pruebas end-to-end crean personas y roles sobre la marcha. Sin esto la base
// acumula basura de corridas anteriores y las capturas del reporte salen con
// veinte filas llamadas `colado-1789144380150@acme.com`.
async function removeLeftovers(prisma: PrismaClient): Promise<void> {
  const seeded = [ANA, BETO, CONTADOR, SUPERUSER, DORA, VERA, BRUCE];
  const seededRoles = [ACME_ADMIN_ROLE, ACME_VIEWER_ROLE, GLOBEX_ADMIN_ROLE, INITECH_ADMIN_ROLE, VOLUME_ADMIN_ROLE, WAYNE_ADMIN_ROLE];

  await prisma.membership.deleteMany({ where: { userId: { notIn: seeded } } });
  await prisma.user.deleteMany({ where: { id: { notIn: seeded } } });
  await prisma.role.deleteMany({ where: { id: { notIn: seededRoles } } });
}

async function syncPermissions(prisma: PrismaClient): Promise<void> {
  for (const { code, description } of SYSTEM_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      create: { code, description },
      update: { description },
    });
  }
}

async function upsertTenants(prisma: PrismaClient): Promise<void> {
  const tenants = [
    { id: ACME, name: 'Acme Industrial', slug: 'acme' },
    { id: GLOBEX, name: 'Globex Servicios', slug: 'globex' },
    { id: INITECH, name: 'Initech Logística', slug: 'initech' },
    { id: VOLUME, name: 'Volumen Distribuciones', slug: 'volumen' },
    { id: WAYNE, name: 'Wayne Enterprises', slug: 'wayne' },
  ];

  for (const tenant of tenants) {
    await prisma.tenant.upsert({ where: { id: tenant.id }, create: tenant, update: tenant });
  }
}

// Los datos que cada empresa pone en sus documentos y sus parametros. Se reescriben en cada corrida:
// una prueba que los cambie no deja a la siguiente con otra moneda u otra zona horaria.
async function upsertCompanies(prisma: PrismaClient): Promise<void> {
  const profiles = [
    { tenantId: ACME, legalName: 'Acme Industrial, C.A.', tradeName: 'Acme', fiscalId: 'J-40000001-2', address: 'Av. Principal de Los Ruices, Caracas', phone: '0212-555-0101', email: 'administracion@acme.com' },
    { tenantId: GLOBEX, legalName: 'Globex Servicios, C.A.', tradeName: 'Globex', fiscalId: 'J-40000002-0', address: 'Av. Bolívar Norte, Valencia', phone: '0241-555-0102', email: 'administracion@globex.com' },
    { tenantId: INITECH, legalName: 'Initech Logística, C.A.', tradeName: null, fiscalId: 'J-40000003-9', address: null, phone: null, email: null },
    { tenantId: VOLUME, legalName: 'Volumen Distribuciones, C.A.', tradeName: null, fiscalId: 'J-40000004-7', address: null, phone: null, email: null },
    { tenantId: WAYNE, legalName: 'Wayne Enterprises, C.A.', tradeName: null, fiscalId: 'J-40000005-5', address: null, phone: null, email: null },
  ];
  const settings = { baseCurrency: 'USD', secondaryCurrency: 'VES', timeZone: 'America/Caracas', amountDecimals: 2, priceDecimals: 6, rateType: 'legal' as const, allowsRateOverride: true };
  const updatedAt = new Date('2026-09-01T12:00:00.000Z');

  for (const profile of profiles) {
    const row = { ...profile, updatedAt };

    await prisma.companyProfile.upsert({ where: { tenantId: profile.tenantId }, create: row, update: row });
    await prisma.companySettings.upsert({
      where: { tenantId: profile.tenantId },
      create: { tenantId: profile.tenantId, ...settings, updatedAt },
      update: { ...settings, updatedAt },
    });
  }
}

// Unas tasas de septiembre para que la pantalla no nazca vacia: la legal del dolar y del euro, y una
// interna del dolar. La de Globex existe para que las pruebas de aislamiento tengan que atacar.
async function upsertExchangeRates(prisma: PrismaClient): Promise<void> {
  const rates = [
    { id: 'f6000000-0000-4000-8000-000000000001', tenantId: ACME, currency: 'USD', rateDate: '2026-09-01', type: 'legal', rate: '150.25', source: 'BCV' },
    { id: 'f6000000-0000-4000-8000-000000000002', tenantId: ACME, currency: 'USD', rateDate: '2026-09-08', type: 'legal', rate: '152.40', source: 'BCV' },
    { id: 'f6000000-0000-4000-8000-000000000003', tenantId: ACME, currency: 'USD', rateDate: '2026-09-11', type: 'legal', rate: '153.10', source: 'BCV' },
    { id: 'f6000000-0000-4000-8000-000000000004', tenantId: ACME, currency: 'EUR', rateDate: '2026-09-01', type: 'legal', rate: '171.30', source: 'BCV' },
    { id: 'f6000000-0000-4000-8000-000000000005', tenantId: ACME, currency: 'EUR', rateDate: '2026-09-11', type: 'legal', rate: '175.05', source: 'BCV' },
    { id: 'f6000000-0000-4000-8000-000000000006', tenantId: ACME, currency: 'USD', rateDate: '2026-09-11', type: 'manual', rate: '160.00', source: 'Tasa interna de compras' },
    // Las de enero valoran cualquier documento de este ano, tambien los de las pruebas.
    { id: 'f6000000-0000-4000-8000-000000000007', tenantId: ACME, currency: 'USD', rateDate: '2026-01-01', type: 'legal', rate: '140.00', source: 'BCV' },
    { id: 'f6000000-0000-4000-8000-000000000008', tenantId: ACME, currency: 'EUR', rateDate: '2026-01-01', type: 'legal', rate: '155.00', source: 'BCV' },
    { id: 'f6000000-0000-4000-8000-000000000102', tenantId: GLOBEX, currency: 'USD', rateDate: '2026-01-01', type: 'legal', rate: '141.00', source: 'BCV' },
    { id: 'f6000000-0000-4000-8000-000000000201', tenantId: INITECH, currency: 'USD', rateDate: '2026-01-01', type: 'legal', rate: '140.00', source: 'BCV' },
    { id: 'f6000000-0000-4000-8000-000000000301', tenantId: VOLUME, currency: 'USD', rateDate: '2026-01-01', type: 'legal', rate: '140.00', source: 'BCV' },
    { id: 'f6000000-0000-4000-8000-000000000401', tenantId: WAYNE, currency: 'USD', rateDate: '2026-01-01', type: 'legal', rate: '140.00', source: 'BCV' },
    { id: 'f6000000-0000-4000-8000-000000000101', tenantId: GLOBEX, currency: 'USD', rateDate: '2026-09-10', type: 'legal', rate: '152.80', source: 'BCV' },
  ] as const;
  const createdAt = new Date('2026-09-01T12:00:00.000Z');

  for (const { rateDate, ...rate } of rates) {
    const row = { ...rate, rateDate: new Date(`${rateDate}T00:00:00.000Z`), isActive: true, createdAt, updatedAt: createdAt };

    await prisma.exchangeRate.upsert({ where: { id: rate.id }, create: row, update: row });
  }
}

async function upsertRoles(prisma: PrismaClient): Promise<void> {
  const roles = [
    { id: ACME_ADMIN_ROLE, tenantId: ACME, name: 'Administrador', grantsAll: true, permissions: [] },
    {
      id: ACME_VIEWER_ROLE,
      tenantId: ACME,
      name: 'Consulta',
      grantsAll: false,
      // Solo lectura tambien en el catalogo y el inventario: es el rol con el que las pruebas comprueban
      // que ver no es lo mismo que poder editar.
      permissions: [
        'access.users.search',
        'company.profile.search',
        'company.rates.search',
        'catalog.categories.search',
        'catalog.units.search',
        'catalog.taxes.search',
        'catalog.warehouses.search',
        'catalog.pricelists.search',
        'inventory.items.search',
        'inventory.adjustments.search',
        'inventory.stock.search',
        'inventory.movements.search',
        'purchasing.suppliers.search',
        'purchasing.orders.search',
        'purchasing.receipts.search',
        'purchasing.incoming.search',
        'purchasing.returns.search',
        'purchasing.invoices.search',
        'sales.customers.search',
        'sales.orders.search',
        'sales.dispatches.search',
        'sales.invoices.search',
        'sales.availability.search',
        'sales.returns.search',
        'receivables.payments.search',
        'receivables.balances.search',
        'receivables.statements.search',
        'receivables.creditnotes.search',
        'payables.payments.search',
        'payables.balances.search',
        'payables.statements.search',
        'payables.creditnotes.search',
        // Sin la valuacion del inventario: muestra costos.
        'reports.dashboard.search',
        'reports.receivables.search',
        'reports.sales.search',
      ],
    },
    { id: GLOBEX_ADMIN_ROLE, tenantId: GLOBEX, name: 'Administrador', grantsAll: true, permissions: [] },
    { id: INITECH_ADMIN_ROLE, tenantId: INITECH, name: 'Administrador', grantsAll: true, permissions: [] },
    { id: VOLUME_ADMIN_ROLE, tenantId: VOLUME, name: 'Administrador', grantsAll: true, permissions: [] },
    { id: WAYNE_ADMIN_ROLE, tenantId: WAYNE, name: 'Administrador', grantsAll: true, permissions: [] },
  ];

  for (const { permissions, ...role } of roles) {
    await prisma.role.upsert({ where: { id: role.id }, create: role, update: role });
    await prisma.rolePermission.createMany({
      data: permissions.map((permissionCode) => ({ roleId: role.id, permissionCode })),
      skipDuplicates: true,
    });
  }
}

async function upsertUsers(prisma: PrismaClient, passwordHash: string): Promise<void> {
  const users = [
    { id: ANA, email: 'ana@acme.com', name: 'Ana Rivas' },
    { id: BETO, email: 'beto@globex.com', name: 'Beto Lugo' },
    // El contador que trabaja para las dos empresas: UNA persona, un solo correo.
    // Es el caso que justifica que `users` no lleve tenantId.
    { id: CONTADOR, email: 'contador@externo.com', name: 'Carla Mena' },
    // Superusuario SIN atajos: no hay un `if (esSuperusuario)` en ningun sitio. Puede
    // todo porque es administrador en cada empresa, y el guardian lo trata igual que a
    // cualquiera. Una empresa nueva no le da acceso hasta que alguien lo invite.
    { id: SUPERUSER, email: 'admin@nexora.com', name: 'Superusuario' },
    // Solo en Initech: nadie mas entra ahi, asi que lo que ella mueve no pisa otra prueba.
    { id: DORA, email: 'dora@initech.com', name: 'Dora Paz' },
    { id: VERA, email: 'vera@volumen.com', name: 'Vera Ruiz' },
    { id: BRUCE, email: 'bruce@wayne.com', name: 'Bruce Wayne' },
  ];

  for (const user of users) {
    const row = { ...user, passwordHash };

    await prisma.user.upsert({ where: { id: user.id }, create: row, update: row });
  }
}

async function upsertMemberships(prisma: PrismaClient): Promise<void> {
  const memberships = [
    { id: 'd0000000-0000-4000-8000-000000000001', userId: ANA, tenantId: ACME, roles: [ACME_ADMIN_ROLE] },
    { id: 'd0000000-0000-4000-8000-000000000002', userId: BETO, tenantId: GLOBEX, roles: [GLOBEX_ADMIN_ROLE] },
    { id: 'd0000000-0000-4000-8000-000000000003', userId: CONTADOR, tenantId: ACME, roles: [ACME_VIEWER_ROLE] },
    { id: 'd0000000-0000-4000-8000-000000000004', userId: CONTADOR, tenantId: GLOBEX, roles: [GLOBEX_ADMIN_ROLE] },
    { id: 'd0000000-0000-4000-8000-000000000005', userId: SUPERUSER, tenantId: ACME, roles: [ACME_ADMIN_ROLE] },
    { id: 'd0000000-0000-4000-8000-000000000006', userId: SUPERUSER, tenantId: GLOBEX, roles: [GLOBEX_ADMIN_ROLE] },
    { id: 'd0000000-0000-4000-8000-000000000007', userId: DORA, tenantId: INITECH, roles: [INITECH_ADMIN_ROLE] },
    { id: 'd0000000-0000-4000-8000-000000000008', userId: VERA, tenantId: VOLUME, roles: [VOLUME_ADMIN_ROLE] },
    { id: 'd0000000-0000-4000-8000-000000000009', userId: BRUCE, tenantId: WAYNE, roles: [WAYNE_ADMIN_ROLE] },
  ];

  for (const { roles, ...membership } of memberships) {
    await prisma.membership.upsert({
      where: { id: membership.id },
      create: membership,
      update: { isActive: true },
    });
    await prisma.membershipRole.createMany({
      data: roles.map((roleId) => ({ membershipId: membership.id, roleId })),
      skipDuplicates: true,
    });
  }
}

async function seedCatalog(prisma: PrismaClient): Promise<void> {
  const { acme, globex, initech } = CATALOG;

  const units = [
    { id: acme.units.piece, tenantId: ACME, code: 'UOM000001', name: 'Unidad', abbreviation: 'un', mustBeWhole: true },
    { id: acme.units.box, tenantId: ACME, code: 'UOM000002', name: 'Caja', abbreviation: 'cja', mustBeWhole: true },
    { id: acme.units.kilo, tenantId: ACME, code: 'UOM000003', name: 'Kilogramo', abbreviation: 'kg' },
    { id: globex.units.piece, tenantId: GLOBEX, code: 'UOM000001', name: 'Unidad', abbreviation: 'un', mustBeWhole: true },
    { id: globex.units.box, tenantId: GLOBEX, code: 'UOM000002', name: 'Caja', abbreviation: 'cja', mustBeWhole: true },
    { id: globex.units.kilo, tenantId: GLOBEX, code: 'UOM000003', name: 'Kilogramo', abbreviation: 'kg' },
    { id: initech.units.piece, tenantId: INITECH, code: 'UOM000001', name: 'Unidad', abbreviation: 'un', mustBeWhole: true },
  ];
  const categories = [
    { id: acme.categories.drinks, tenantId: ACME, code: 'CAT000001', name: 'Bebidas', description: null },
    { id: acme.categories.cleaning, tenantId: ACME, code: 'CAT000002', name: 'Limpieza', description: null },
    { id: globex.categories.parts, tenantId: GLOBEX, code: 'CAT000001', name: 'Repuestos', description: null },
  ];
  const taxes = [
    { id: acme.taxes.vat, tenantId: ACME, code: 'IMP000001', name: 'IVA 16%', rate: 16 },
    { id: acme.taxes.exempt, tenantId: ACME, code: 'IMP000002', name: 'Exento', rate: 0 },
    { id: globex.taxes.vat, tenantId: GLOBEX, code: 'IMP000001', name: 'IVA 16%', rate: 16 },
  ];
  // Las que no son por defecto van primero, igual que en el repositorio: si una prueba
  // dejo marcada otra, se le quita antes de devolversela a la suya.
  const warehouses = [
    { id: initech.warehouses.second, tenantId: INITECH, code: 'BOD000002', name: 'Secundaria', address: null, isDefault: false },
    { id: acme.warehouses.north, tenantId: ACME, code: 'BOD000002', name: 'Norte', address: null, isDefault: false },
    { id: acme.warehouses.main, tenantId: ACME, code: 'BOD000001', name: 'Principal', address: 'Zona Industrial, galpón 4', isDefault: true },
    { id: globex.warehouses.main, tenantId: GLOBEX, code: 'BOD000001', name: 'Central', address: null, isDefault: true },
    { id: initech.warehouses.main, tenantId: INITECH, code: 'BOD000001', name: 'Principal', address: null, isDefault: true },
  ];
  const items = [
    {
      id: acme.items.water, tenantId: ACME, code: 'ART000001', sku: 'AGUA-500', name: 'Agua mineral 500 ml', barcode: '7591234567890',
      description: null, type: 'inventoried' as const, categoryId: acme.categories.drinks, salesTaxId: acme.taxes.vat, purchaseTaxId: acme.taxes.vat,
      units: [
        { unitId: acme.units.piece, conversionFactor: 1, isBase: true },
        { unitId: acme.units.box, conversionFactor: 24, isBase: false },
      ],
    },
    {
      id: acme.items.detergent, tenantId: ACME, code: 'ART000002', sku: 'DETERGENTE-1KG', name: 'Detergente en polvo 1 kg', barcode: '7591234567891',
      description: null, type: 'inventoried' as const, categoryId: acme.categories.cleaning, salesTaxId: acme.taxes.vat, purchaseTaxId: acme.taxes.exempt,
      units: [{ unitId: acme.units.kilo, conversionFactor: 1, isBase: true }],
    },
    {
      id: acme.items.delivery, tenantId: ACME, code: 'ART000003', sku: 'SERV-ENTREGA', name: 'Servicio de entrega',
      description: 'Entrega a domicilio dentro de la ciudad', type: 'service' as const, categoryId: null, isPurchasable: false,
      salesTaxId: acme.taxes.exempt, purchaseTaxId: acme.taxes.exempt, units: [{ unitId: acme.units.piece, conversionFactor: 1, isBase: true }],
    },
    {
      id: acme.items.soap, tenantId: ACME, code: 'ART000004', sku: 'JABON-500', name: 'Jabón líquido 500 ml', barcode: null,
      description: null, type: 'inventoried' as const, categoryId: acme.categories.cleaning, salesTaxId: acme.taxes.vat, purchaseTaxId: acme.taxes.vat,
      units: [{ unitId: acme.units.piece, conversionFactor: 1, isBase: true }],
    },
    {
      id: globex.items.filter, tenantId: GLOBEX, code: 'ART000001', sku: 'FILTRO-ACEITE', name: 'Filtro de aceite',
      description: null, type: 'inventoried' as const, categoryId: globex.categories.parts, salesTaxId: globex.taxes.vat, purchaseTaxId: globex.taxes.vat,
      units: [{ unitId: globex.units.piece, conversionFactor: 1, isBase: true }],
    },
  ];

  // Acme cotiza en dolares: al detal y al mayor, con la del detal por defecto. El mayor rebaja el
  // agua y el detergente, que es lo que se ve en la pantalla del pedido.
  const priceLists = [
    { id: acme.priceLists.retail, tenantId: ACME, code: 'LPR000001', name: 'Detal', description: 'Precio de mostrador', currency: 'USD', isDefault: true },
    { id: acme.priceLists.wholesale, tenantId: ACME, code: 'LPR000002', name: 'Mayorista', description: 'Desde 10 unidades', currency: 'USD', isDefault: false },
    { id: globex.priceLists.retail, tenantId: GLOBEX, code: 'LPR000001', name: 'General', description: null, currency: 'USD', isDefault: true },
  ];

  await removeCatalogLeftovers(prisma, { units, categories, taxes, warehouses, priceLists, items });

  for (const unit of units) {
    await prisma.measurementUnit.upsert({ where: { id: unit.id }, create: unit, update: { ...unit, isActive: true } });
  }
  for (const category of categories) {
    await prisma.category.upsert({ where: { id: category.id }, create: category, update: { ...category, isActive: true } });
  }
  for (const tax of taxes) {
    await prisma.tax.upsert({ where: { id: tax.id }, create: tax, update: { ...tax, isActive: true } });
  }
  for (const warehouse of warehouses) {
    await prisma.warehouse.upsert({ where: { id: warehouse.id }, create: warehouse, update: { ...warehouse, isActive: true } });
  }
  for (const priceList of priceLists) {
    await prisma.priceList.upsert({ where: { id: priceList.id }, create: priceList, update: { ...priceList, isActive: true } });
  }
  for (const { units: itemUnits, ...item } of items) {
    await prisma.item.upsert({ where: { id: item.id }, create: item, update: { ...item, isActive: true } });
    await prisma.itemUnit.deleteMany({ where: { itemId: item.id } });
    await prisma.itemUnit.createMany({
      data: itemUnits.map((unit) => ({ tenantId: item.tenantId, itemId: item.id, ...unit })),
    });
  }

  // Precios por lista, en la unidad base del articulo. El servicio de entrega tambien se cotiza.
  await prisma.itemPrice.deleteMany({ where: { tenantId: { in: [ACME, GLOBEX] } } });
  await prisma.itemPrice.createMany({
    data: [
      { tenantId: ACME, itemId: acme.items.water, priceListId: acme.priceLists.retail, price: 0.85 },
      { tenantId: ACME, itemId: acme.items.water, priceListId: acme.priceLists.wholesale, price: 0.7 },
      { tenantId: ACME, itemId: acme.items.detergent, priceListId: acme.priceLists.retail, price: 4.5 },
      { tenantId: ACME, itemId: acme.items.detergent, priceListId: acme.priceLists.wholesale, price: 3.9 },
      { tenantId: ACME, itemId: acme.items.delivery, priceListId: acme.priceLists.retail, price: 3 },
      { tenantId: ACME, itemId: acme.items.soap, priceListId: acme.priceLists.retail, price: 4.0 },
      { tenantId: ACME, itemId: acme.items.soap, priceListId: acme.priceLists.wholesale, price: 3.5 },
      { tenantId: GLOBEX, itemId: globex.items.filter, priceListId: globex.priceLists.retail, price: 12 },
    ],
  });

  // Reglas de reposicion, contra la existencia PROYECTADA. El agua ensena por que: hay 288 y el
  // minimo es 300, pero una orden trae 144 y un pedido reserva 72, asi que proyecta 360 y no hay
  // que pedir nada. El detergente si falta: 50 menos 10 vendidos mas 20 en camino son 60, bajo 80.
  await prisma.itemReorderRule.deleteMany({ where: { tenantId: { in: [ACME, GLOBEX] } } });
  await prisma.itemReorderRule.createMany({
    data: [
      { tenantId: ACME, itemId: acme.items.water, warehouseId: acme.warehouses.main, minQuantity: 300, maxQuantity: 960, reorderQuantity: 480 },
      { tenantId: ACME, itemId: acme.items.detergent, warehouseId: acme.warehouses.main, minQuantity: 80, maxQuantity: null, reorderQuantity: 0 },
      { tenantId: GLOBEX, itemId: globex.items.filter, warehouseId: globex.warehouses.main, minQuantity: 10, maxQuantity: null, reorderQuantity: 20 },
    ],
  });


  // El contador nunca retrocede: si las pruebas ya numeraron mas alla de lo sembrado, se
  // queda donde esta; si no existia, arranca despues del ultimo codigo sembrado.
  const rows = [...units, ...categories, ...taxes, ...warehouses, ...priceLists, ...items];
  const highest = new Map<string, number>();

  for (const { tenantId, code } of rows) {
    const key = `${tenantId}|${code.slice(0, 3)}`;
    highest.set(key, Math.max(highest.get(key) ?? 0, Number(code.slice(3))));
  }

  for (const [key, lastValue] of highest) {
    const [tenantId, prefix] = key.split('|');

    await prisma.$executeRaw`
      INSERT INTO code_sequences (tenant_id, prefix, last_value)
      VALUES (${tenantId}::uuid, ${prefix}, ${lastValue})
      ON CONFLICT (tenant_id, prefix)
      DO UPDATE SET last_value = GREATEST(code_sequences.last_value, EXCLUDED.last_value)`;
  }
}

// Lo que las pruebas crean sobre la marcha se borra aqui, igual que las personas: la
// politica de no borrado es del sistema, no de una base de demostracion. Los articulos
// primero, porque las claves ajenas no dejan borrar lo que un articulo usa.
async function removeCatalogLeftovers(
  prisma: PrismaClient,
  seeded: { [table: string]: { id: string }[] },
): Promise<void> {
  const ids = (table: string) => seeded[table].map((row) => row.id);

  await prisma.item.deleteMany({ where: { id: { notIn: ids('items') } } });
  await prisma.priceList.deleteMany({ where: { id: { notIn: ids('priceLists') } } });
  await prisma.category.deleteMany({ where: { id: { notIn: ids('categories') } } });
  await prisma.tax.deleteMany({ where: { id: { notIn: ids('taxes') } } });
  await prisma.measurementUnit.deleteMany({ where: { id: { notIn: ids('units') } } });
  await prisma.warehouse.deleteMany({ where: { id: { notIn: ids('warehouses') } } });
}

// Compras e inventario de demostracion se rehacen enteros en cada corrida: las pruebas
// confirman y anulan documentos, y dejar sus existencias haria que el seed no fuera el mismo
// dos veces. Compras primero: sus documentos apuntan a articulos y bodegas.
async function removeInventory(prisma: PrismaClient): Promise<void> {
  await prisma.supplierPaymentAllocation.deleteMany();
  await prisma.paymentAllocation.deleteMany();
  await prisma.supplierCreditNote.updateMany({ data: { issuePaymentId: null } });
  await prisma.customerCreditNote.updateMany({ data: { issuePaymentId: null } });
  await prisma.supplierPayment.updateMany({ data: { creditSourceId: null } });
  await prisma.customerPayment.updateMany({ data: { creditSourceId: null } });
  await prisma.supplierCreditNoteLine.deleteMany();
  await prisma.supplierCreditNote.deleteMany();
  await prisma.customerCreditNoteLine.deleteMany();
  await prisma.customerCreditNote.deleteMany();
  await prisma.supplierPayment.deleteMany();
  await prisma.customerPayment.deleteMany();
  await prisma.salesReturnLine.deleteMany();
  await prisma.salesReturn.deleteMany();
  await prisma.purchaseReturnLine.deleteMany();
  await prisma.purchaseReturn.deleteMany();
  await prisma.purchaseInvoiceLine.deleteMany();
  await prisma.purchaseInvoice.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.dispatchLine.deleteMany();
  await prisma.dispatch.deleteMany();
  await prisma.salesOrderLine.deleteMany();
  await prisma.salesOrder.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.goodsReceiptLine.deleteMany();
  await prisma.goodsReceipt.deleteMany();
  await prisma.purchaseOrderLine.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.adjustmentLine.deleteMany();
  await prisma.adjustment.deleteMany();
  await prisma.inventoryMovement.updateMany({ data: { reversalOfId: null, restoresMovementId: null } });
  await prisma.inventoryMovement.deleteMany();
  await prisma.itemStock.deleteMany();
}

// Dos ajustes confirmados, con sus movimientos y existencias escritos como los escribiria
// el sistema (una caja de 24 a 12 entra a 0,5 por unidad), y un borrador por empresa.
async function seedInventory(prisma: PrismaClient): Promise<void> {
  const { acme, globex } = CATALOG;
  const confirmedAt = new Date('2026-09-01T12:00:00.000Z');
  const date = new Date('2026-09-01T00:00:00.000Z');

  const adjustments = [
    {
      id: INVENTORY.acme.opening, tenantId: ACME, code: 'AJU000001', warehouseId: acme.warehouses.main, notes: 'Conteo inicial',
      type: 'physical_count' as const, status: 'confirmed' as const, confirmedAt, createdBy: ANA, confirmedBy: ANA,
      lines: [
        { id: INVENTORY.acme.openingWater, itemId: acme.items.water, unitId: acme.units.box, quantity: 10, baseQuantity: 240, unitCost: 12 },
        { id: INVENTORY.acme.openingDetergent, itemId: acme.items.detergent, unitId: acme.units.kilo, quantity: 50, baseQuantity: 50, unitCost: 3.2 },
        { id: INVENTORY.acme.openingSoap, itemId: acme.items.soap, unitId: acme.units.piece, quantity: 100, baseQuantity: 100, unitCost: 1.5 },
      ],
    },
    {
      id: INVENTORY.acme.breakage, tenantId: ACME, code: 'AJU000002', warehouseId: acme.warehouses.main, notes: 'Merma por rotura',
      type: 'damage' as const, status: 'draft' as const, confirmedAt: null, createdBy: ANA, confirmedBy: null,
      lines: [{ id: INVENTORY.acme.breakageWater, itemId: acme.items.water, unitId: acme.units.piece, quantity: 6, baseQuantity: 6, unitCost: null }],
      direction: 'out' as const,
    },
    {
      id: INVENTORY.globex.opening, tenantId: GLOBEX, code: 'AJU000001', warehouseId: globex.warehouses.main, notes: 'Conteo inicial',
      type: 'physical_count' as const, status: 'confirmed' as const, confirmedAt, createdBy: BETO, confirmedBy: BETO,
      lines: [{ id: INVENTORY.globex.openingFilter, itemId: globex.items.filter, unitId: globex.units.piece, quantity: 15, baseQuantity: 15, unitCost: 7.0 }],
    },
    {
      id: INVENTORY.globex.draft, tenantId: GLOBEX, code: 'AJU000002', warehouseId: globex.warehouses.main, notes: 'Filtros dañados',
      type: 'damage' as const, status: 'draft' as const, confirmedAt: null, createdBy: BETO, confirmedBy: null,
      lines: [{ id: INVENTORY.globex.draftFilter, itemId: globex.items.filter, unitId: globex.units.piece, quantity: 2, baseQuantity: 2, unitCost: null }],
      direction: 'out' as const,
    },
  ];

  for (const { lines, direction = 'in', ...adjustment } of adjustments) {
    await prisma.adjustment.create({ data: { ...adjustment, adjustmentDate: date, createdAt: date, updatedAt: confirmedAt } });
    await prisma.adjustmentLine.createMany({
      data: lines.map((line, index) => ({
        ...line,
        ...labelsOf(line.itemId),
        tenantId: adjustment.tenantId,
        adjustmentId: adjustment.id,
        lineNumber: index + 1,
        direction,
      })),
    });
  }

  const stocks = [
    { tenantId: ACME, itemId: acme.items.water, warehouseId: acme.warehouses.main, quantity: 240, cost: 0.5, movement: INVENTORY.acme.waterMovement, adjustmentId: INVENTORY.acme.opening, lineId: INVENTORY.acme.openingWater },
    { tenantId: ACME, itemId: acme.items.detergent, warehouseId: acme.warehouses.main, quantity: 50, cost: 3.2, movement: INVENTORY.acme.detergentMovement, adjustmentId: INVENTORY.acme.opening, lineId: INVENTORY.acme.openingDetergent },
    { tenantId: ACME, itemId: acme.items.soap, warehouseId: acme.warehouses.main, quantity: 100, cost: 1.5, movement: INVENTORY.acme.soapMovement, adjustmentId: INVENTORY.acme.opening, lineId: INVENTORY.acme.openingSoap },
    { tenantId: GLOBEX, itemId: globex.items.filter, warehouseId: globex.warehouses.main, quantity: 15, cost: 7.0, movement: INVENTORY.globex.filterMovement, adjustmentId: INVENTORY.globex.opening, lineId: INVENTORY.globex.openingFilter },
  ];

  for (const stock of stocks) {
    await prisma.inventoryMovement.create({
      data: {
        id: stock.movement, tenantId: stock.tenantId, itemId: stock.itemId, warehouseId: stock.warehouseId, sequence: 1,
        direction: 'in', quantity: stock.quantity, unitCost: stock.cost, balanceQuantity: stock.quantity,
        balanceAverageCost: stock.cost, originType: 'adjustment', originId: stock.adjustmentId, originLineId: stock.lineId,
        originDate: date, occurredAt: confirmedAt,
      },
    });
    await prisma.itemStock.create({
      data: {
        tenantId: stock.tenantId, itemId: stock.itemId, warehouseId: stock.warehouseId, quantity: stock.quantity,
        averageCost: stock.cost, lastSequence: 1, updatedAt: confirmedAt,
      },
    });
  }

  for (const tenantId of [ACME, GLOBEX]) {
    await prisma.$executeRaw`
      INSERT INTO code_sequences (tenant_id, prefix, last_value)
      VALUES (${tenantId}::uuid, 'AJU', 2)
      ON CONFLICT (tenant_id, prefix)
      DO UPDATE SET last_value = GREATEST(code_sequences.last_value, EXCLUDED.last_value)`;
  }
}

// Una orden de Acme recibida en parte, con su entrada confirmada escrita como la escribiria el
// sistema (4 cajas de 24 a 12 entran a 0,5 por unidad y el agua pasa de 240 a 336), y un
// borrador. En Globex, lo que ataca la matriz de aislamiento.
// En dolares, la moneda de la empresa, con la tasa legal del dia del documento.
const dollarsAt = (rate: number) => ({ currency: 'USD', exchangeRate: rate, baseCurrency: 'USD', baseExchangeRate: rate, manualExchangeRate: false });

async function seedPurchasing(prisma: PrismaClient): Promise<void> {
  const { acme, globex } = CATALOG;
  const at = (day: string) => new Date(`${day}T12:00:00.000Z`);
  const date = (day: string) => new Date(`${day}T00:00:00.000Z`);
  // En dolares, con la tasa legal de su fecha: la del 1 de septiembre en Acme y la de enero en Globex.
  const dollars = (tenantId: string) => {
    const rate = tenantId === ACME ? 150.25 : 141;

    return { currency: 'USD', exchangeRate: rate, baseCurrency: 'USD', baseExchangeRate: rate, manualExchangeRate: false };
  };

  await prisma.supplier.createMany({
    data: [
      {
        id: PURCHASING.acme.andina, tenantId: ACME, code: 'PRV000001', name: 'Distribuidora Andina', fiscalId: 'J-30512345-6',
        email: 'compras@andina.com', phone: '+58 212 555 0101', address: 'Av. Principal de Los Ruices', paymentTermDays: 30,
      },
      { id: PURCHASING.acme.valle, tenantId: ACME, code: 'PRV000002', name: 'Aguas del Valle', paymentTermDays: 0 },
      { id: PURCHASING.globex.supplier, tenantId: GLOBEX, code: 'PRV000001', name: 'Repuestos Industriales', paymentTermDays: 15 },
    ],
  });

  const orders = [
    {
      id: PURCHASING.acme.partialOrder, tenantId: ACME, code: 'OC000001', supplierId: PURCHASING.acme.andina,
      warehouseId: acme.warehouses.main, orderDate: date('2026-09-02'), expectedDate: date('2026-09-10'),
      notes: 'Reposición quincenal', paymentTermDays: 30, status: 'partially_received' as const, confirmedAt: at('2026-09-02'),
      lines: [
        { id: PURCHASING.acme.partialWater, itemId: acme.items.water, unitId: acme.units.box, quantity: 10, baseQuantity: 240, unitCost: 12, taxRate: 16, receivedQuantity: 4, invoicedQuantity: 4 },
        { id: PURCHASING.acme.partialDetergent, itemId: acme.items.detergent, unitId: acme.units.kilo, quantity: 20, baseQuantity: 20, unitCost: 3.1, taxRate: 16, receivedQuantity: 0 },
      ],
    },
    {
      id: PURCHASING.acme.draftOrder, tenantId: ACME, code: 'OC000002', supplierId: PURCHASING.acme.valle,
      warehouseId: acme.warehouses.main, orderDate: date('2026-09-06'), expectedDate: null, notes: null,
      paymentTermDays: 0, status: 'draft' as const, confirmedAt: null,
      lines: [{ id: PURCHASING.acme.draftWater, itemId: acme.items.water, unitId: acme.units.piece, quantity: 48, baseQuantity: 48, unitCost: 0.45, taxRate: 16, receivedQuantity: 0 }],
    },
    {
      id: PURCHASING.acme.soapOrder, tenantId: ACME, code: 'OC000003', supplierId: PURCHASING.acme.valle,
      warehouseId: acme.warehouses.main, orderDate: date('2026-09-03'), expectedDate: date('2026-09-04'),
      notes: 'Compra de jabón líquido', paymentTermDays: 0, status: 'received' as const, confirmedAt: at('2026-09-03'),
      lines: [
        { id: PURCHASING.acme.soapOrderLine, itemId: acme.items.soap, unitId: acme.units.piece, quantity: 20, baseQuantity: 20, unitCost: 1.5, taxRate: 16, receivedQuantity: 20, invoicedQuantity: 20 },
      ],
    },
    {
      id: PURCHASING.acme.serviceOrder, tenantId: ACME, code: 'OC000004', supplierId: PURCHASING.acme.andina,
      warehouseId: acme.warehouses.main, orderDate: date('2026-09-02'), expectedDate: null, notes: 'Servicio de flete y entrega',
      paymentTermDays: 30, status: 'confirmed' as const, confirmedAt: at('2026-09-02'),
      lines: [
        { id: PURCHASING.acme.serviceOrderLine, itemId: acme.items.delivery, unitId: acme.units.piece, quantity: 1, baseQuantity: 1, unitCost: 20, taxRate: 16, receivedQuantity: 0, invoicedQuantity: 1, movesStock: false },
      ],
    },
    {
      id: PURCHASING.acme.northOrder, tenantId: ACME, code: 'OC000005', supplierId: PURCHASING.acme.andina,
      warehouseId: acme.warehouses.north, orderDate: date('2026-09-03'), expectedDate: date('2026-09-04'), notes: 'Compra para sucursal Norte',
      paymentTermDays: 30, status: 'received' as const, confirmedAt: at('2026-09-03'),
      lines: [
        { id: PURCHASING.acme.northOrderLine, itemId: acme.items.detergent, unitId: acme.units.kilo, quantity: 10, baseQuantity: 10, unitCost: 3.0, taxRate: 16, receivedQuantity: 10, invoicedQuantity: 10, movesStock: true },
      ],
    },
    {
      id: PURCHASING.acme.interWarehouseWaterOrder, tenantId: ACME, code: 'OC000006', supplierId: PURCHASING.acme.andina,
      warehouseId: acme.warehouses.main, orderDate: date('2026-09-04'), expectedDate: date('2026-09-05'),
      notes: 'Reposición agua para inter-bodegas', paymentTermDays: 30, status: 'received' as const, confirmedAt: at('2026-09-04'),
      lines: [
        { id: PURCHASING.acme.interWarehouseWaterOrderLine, itemId: acme.items.water, unitId: acme.units.box, quantity: 2, baseQuantity: 48, unitCost: 12, taxRate: 16, receivedQuantity: 2, invoicedQuantity: 2, movesStock: true },
      ],
    },
    {
      id: PURCHASING.acme.interWarehouseNorthOrder, tenantId: ACME, code: 'OC000007', supplierId: PURCHASING.acme.andina,
      warehouseId: acme.warehouses.north, orderDate: date('2026-09-04'), expectedDate: date('2026-09-05'),
      notes: 'Reposición detergente para inter-bodegas', paymentTermDays: 30, status: 'received' as const, confirmedAt: at('2026-09-04'),
      lines: [
        { id: PURCHASING.acme.interWarehouseNorthOrderLine, itemId: acme.items.detergent, unitId: acme.units.kilo, quantity: 3, baseQuantity: 3, unitCost: 3.0, taxRate: 16, receivedQuantity: 3, invoicedQuantity: 3, movesStock: true },
      ],
    },
    {
      id: PURCHASING.globex.confirmedOrder, tenantId: GLOBEX, code: 'OC000001', supplierId: PURCHASING.globex.supplier,
      warehouseId: globex.warehouses.main, orderDate: date('2026-09-03'), expectedDate: null, notes: 'Filtros para taller',
      paymentTermDays: 15, status: 'confirmed' as const, confirmedAt: at('2026-09-03'),
      lines: [{ id: PURCHASING.globex.confirmedFilter, itemId: globex.items.filter, unitId: globex.units.piece, quantity: 20, baseQuantity: 20, unitCost: 10, taxRate: 16, receivedQuantity: 15, invoicedQuantity: 10 }],
    },
    {
      id: PURCHASING.globex.draftOrder, tenantId: GLOBEX, code: 'OC000002', supplierId: PURCHASING.globex.supplier,
      warehouseId: globex.warehouses.main, orderDate: date('2026-09-04'), expectedDate: null, notes: null,
      paymentTermDays: 15, status: 'draft' as const, confirmedAt: null,
      lines: [{ id: PURCHASING.globex.draftFilter, itemId: globex.items.filter, unitId: globex.units.piece, quantity: 5, baseQuantity: 5, unitCost: 8, taxRate: 16, receivedQuantity: 0 }],
    },
  ];

  for (const { lines, ...order } of orders) {
    await prisma.purchaseOrder.create({ data: { ...order, ...dollars(order.tenantId), createdAt: order.orderDate, updatedAt: order.confirmedAt ?? order.orderDate } });
    await prisma.purchaseOrderLine.createMany({
      data: lines.map((line, index) => ({ ...line, ...labelsOf(line.itemId), tenantId: order.tenantId, orderId: order.id, lineNumber: index + 1 })),
    });
  }

  const receipts = [
    {
      id: PURCHASING.acme.receipt, tenantId: ACME, code: 'ENT000001', orderId: PURCHASING.acme.partialOrder,
      warehouseId: acme.warehouses.main, receiptDate: date('2026-09-05'), notes: 'Llegaron 4 de 10 cajas',
      status: 'confirmed' as const, confirmedAt: at('2026-09-05'),
      lines: [{ id: PURCHASING.acme.receiptWater, orderLineId: PURCHASING.acme.partialWater, itemId: acme.items.water, unitId: acme.units.box, quantity: 4, baseQuantity: 96, unitCost: 12 }],
    },
    {
      id: PURCHASING.acme.soapReceipt, tenantId: ACME, code: 'ENT000002', orderId: PURCHASING.acme.soapOrder,
      warehouseId: acme.warehouses.main, receiptDate: date('2026-09-04'), notes: 'Recepción conforme',
      status: 'confirmed' as const, confirmedAt: at('2026-09-04'),
      lines: [{ id: PURCHASING.acme.soapReceiptLine, orderLineId: PURCHASING.acme.soapOrderLine, itemId: acme.items.soap, unitId: acme.units.piece, quantity: 20, baseQuantity: 20, unitCost: 1.5 }],
    },
    {
      id: PURCHASING.acme.northReceipt, tenantId: ACME, code: 'ENT000003', orderId: PURCHASING.acme.northOrder,
      warehouseId: acme.warehouses.north, receiptDate: date('2026-09-04'), notes: 'Recepción en Norte conforme',
      status: 'confirmed' as const, confirmedAt: at('2026-09-04'),
      lines: [{ id: PURCHASING.acme.northReceiptLine, orderLineId: PURCHASING.acme.northOrderLine, itemId: acme.items.detergent, unitId: acme.units.kilo, quantity: 10, baseQuantity: 10, unitCost: 3.0 }],
    },
    {
      id: PURCHASING.acme.interWarehouseWaterReceipt, tenantId: ACME, code: 'ENT000004', orderId: PURCHASING.acme.interWarehouseWaterOrder,
      warehouseId: acme.warehouses.main, receiptDate: date('2026-09-05'), notes: 'Recepción agua para inter-bodegas',
      status: 'confirmed' as const, confirmedAt: at('2026-09-05'),
      lines: [{ id: PURCHASING.acme.interWarehouseWaterReceiptLine, orderLineId: PURCHASING.acme.interWarehouseWaterOrderLine, itemId: acme.items.water, unitId: acme.units.box, quantity: 2, baseQuantity: 48, unitCost: 12 }],
    },
    {
      id: PURCHASING.acme.interWarehouseNorthReceipt, tenantId: ACME, code: 'ENT000005', orderId: PURCHASING.acme.interWarehouseNorthOrder,
      warehouseId: acme.warehouses.north, receiptDate: date('2026-09-04'), notes: 'Recepción detergente para inter-bodegas',
      status: 'confirmed' as const, confirmedAt: at('2026-09-04'),
      lines: [{ id: PURCHASING.acme.interWarehouseNorthReceiptLine, orderLineId: PURCHASING.acme.interWarehouseNorthOrderLine, itemId: acme.items.detergent, unitId: acme.units.kilo, quantity: 3, baseQuantity: 3, unitCost: 3.0 }],
    },
    {
      id: PURCHASING.globex.receipt, tenantId: GLOBEX, code: 'ENT000001', orderId: PURCHASING.globex.confirmedOrder,
      warehouseId: globex.warehouses.main, receiptDate: date('2026-09-04'), notes: 'Recepción filtros para taller',
      status: 'confirmed' as const, confirmedAt: at('2026-09-04'),
      lines: [{ id: PURCHASING.globex.receiptFilter, orderLineId: PURCHASING.globex.confirmedFilter, itemId: globex.items.filter, unitId: globex.units.piece, quantity: 15, baseQuantity: 15, unitCost: 10 }],
    },
    {
      id: PURCHASING.globex.draftReceipt, tenantId: GLOBEX, code: 'ENT000002', orderId: PURCHASING.globex.confirmedOrder,
      warehouseId: globex.warehouses.main, receiptDate: date('2026-09-06'), notes: null, status: 'draft' as const, confirmedAt: null,
      lines: [{ id: PURCHASING.globex.draftReceiptFilter, orderLineId: PURCHASING.globex.confirmedFilter, itemId: globex.items.filter, unitId: globex.units.piece, quantity: 5, baseQuantity: 5, unitCost: 8 }],
    },
  ];

  for (const { lines, ...receipt } of receipts) {
    await prisma.goodsReceipt.create({ data: { ...receipt, ...dollars(receipt.tenantId), createdAt: receipt.receiptDate, updatedAt: receipt.confirmedAt ?? receipt.receiptDate } });
    await prisma.goodsReceiptLine.createMany({
      data: lines.map((line, index) => ({ ...line, ...labelsOf(line.itemId), tenantId: receipt.tenantId, receiptId: receipt.id, lineNumber: index + 1 })),
    });
  }

  await prisma.inventoryMovement.create({
    data: {
      id: PURCHASING.acme.receiptMovement, tenantId: ACME, itemId: acme.items.water, warehouseId: acme.warehouses.main, sequence: 2,
      direction: 'in', quantity: 96, unitCost: 0.5, balanceQuantity: 336, balanceAverageCost: 0.5, originType: 'receipt',
      originId: PURCHASING.acme.receipt, originLineId: PURCHASING.acme.receiptWater, originDate: at('2026-09-05'), occurredAt: at('2026-09-05'),
    },
  });
  await prisma.itemStock.update({
    where: { tenantId_itemId_warehouseId: { tenantId: ACME, itemId: acme.items.water, warehouseId: acme.warehouses.main } },
    data: { quantity: 336, lastSequence: 2, updatedAt: at('2026-09-05') },
  });

  await prisma.inventoryMovement.create({
    data: {
      id: PURCHASING.acme.soapReceiptMovement, tenantId: ACME, itemId: acme.items.soap, warehouseId: acme.warehouses.main, sequence: 2,
      direction: 'in', quantity: 20, unitCost: 1.5, balanceQuantity: 120, balanceAverageCost: 1.5, originType: 'receipt',
      originId: PURCHASING.acme.soapReceipt, originLineId: PURCHASING.acme.soapReceiptLine, originDate: at('2026-09-04'), occurredAt: at('2026-09-04'),
    },
  });
  await prisma.itemStock.update({
    where: { tenantId_itemId_warehouseId: { tenantId: ACME, itemId: acme.items.soap, warehouseId: acme.warehouses.main } },
    data: { quantity: 120, lastSequence: 2, updatedAt: at('2026-09-04') },
  });

  // H8 Caso 5: Devolucion de compra DVC000001
  await prisma.purchaseReturn.create({
    data: {
      id: PURCHASING.acme.purchaseReturn,
      tenantId: ACME,
      code: 'DVC000001',
      supplierId: PURCHASING.acme.valle,
      receiptId: PURCHASING.acme.soapReceipt,
      warehouseId: acme.warehouses.main,
      returnDate: date('2026-09-05'),
      reason: 'Empaque defectuoso',
      notes: 'Devolución acordada con el proveedor',
      status: 'confirmed',
      confirmedAt: at('2026-09-05'),
      ...dollars(ACME),
      createdAt: at('2026-09-05'),
      updatedAt: at('2026-09-05'),
    },
  });
  await prisma.purchaseReturnLine.create({
    data: {
      id: PURCHASING.acme.purchaseReturnLine,
      tenantId: ACME,
      purchaseReturnId: PURCHASING.acme.purchaseReturn,
      receiptLineId: PURCHASING.acme.soapReceiptLine,
      lineNumber: 1,
      itemId: acme.items.soap,
      ...labelsOf(acme.items.soap),
      unitId: acme.units.piece,
      quantity: 4,
      baseQuantity: 4,
      unitCost: 1.5,
      restoresMovementId: PURCHASING.acme.soapReceiptMovement,
    },
  });
  await prisma.inventoryMovement.create({
    data: {
      id: PURCHASING.acme.purchaseReturnMovement,
      tenantId: ACME,
      itemId: acme.items.soap,
      warehouseId: acme.warehouses.main,
      sequence: 3,
      direction: 'out',
      quantity: 4,
      unitCost: 1.5,
      balanceQuantity: 116,
      balanceAverageCost: 1.5,
      originType: 'purchase_return',
      originId: PURCHASING.acme.purchaseReturn,
      originLineId: PURCHASING.acme.purchaseReturnLine,
      restoresMovementId: PURCHASING.acme.soapReceiptMovement,
      originDate: at('2026-09-05'),
      occurredAt: at('2026-09-05'),
    },
  });
  await prisma.itemStock.update({
    where: { tenantId_itemId_warehouseId: { tenantId: ACME, itemId: acme.items.soap, warehouseId: acme.warehouses.main } },
    data: { quantity: 116, lastSequence: 3, updatedAt: at('2026-09-05') },
  });

  await prisma.inventoryMovement.create({
    data: {
      id: PURCHASING.acme.northReceiptMovement, tenantId: ACME, itemId: acme.items.detergent, warehouseId: acme.warehouses.north, sequence: 1,
      direction: 'in', quantity: 10, unitCost: 3.0, balanceQuantity: 10, balanceAverageCost: 3.0, originType: 'receipt',
      originId: PURCHASING.acme.northReceipt, originLineId: PURCHASING.acme.northReceiptLine, originDate: at('2026-09-04'), occurredAt: at('2026-09-04'),
    },
  });
  await prisma.itemStock.create({
    data: {
      tenantId: ACME, itemId: acme.items.detergent, warehouseId: acme.warehouses.north,
      quantity: 10, averageCost: 3.0, lastSequence: 1, updatedAt: at('2026-09-04'),
    },
  });

  await prisma.inventoryMovement.create({
    data: {
      id: PURCHASING.globex.receiptMovement, tenantId: GLOBEX, itemId: globex.items.filter, warehouseId: globex.warehouses.main, sequence: 2,
      direction: 'in', quantity: 15, unitCost: 10, balanceQuantity: 30, balanceAverageCost: 8.5, originType: 'receipt',
      originId: PURCHASING.globex.receipt, originLineId: PURCHASING.globex.receiptFilter, originDate: at('2026-09-04'), occurredAt: at('2026-09-04'),
    },
  });
  await prisma.itemStock.update({
    where: { tenantId_itemId_warehouseId: { tenantId: GLOBEX, itemId: globex.items.filter, warehouseId: globex.warehouses.main } },
    data: { quantity: 30, lastSequence: 2, averageCost: 8.5, updatedAt: at('2026-09-04') },
  });

  for (const [tenantId, prefix, lastValue] of [
    [ACME, 'PRV', 2], [ACME, 'OC', 7], [ACME, 'ENT', 5], [ACME, 'DVC', 1],
    [GLOBEX, 'PRV', 1], [GLOBEX, 'OC', 2], [GLOBEX, 'ENT', 2],
  ] as const) {
    await prisma.$executeRaw`
      INSERT INTO code_sequences (tenant_id, prefix, last_value)
      VALUES (${tenantId}::uuid, ${prefix}, ${lastValue})
      ON CONFLICT (tenant_id, prefix)
      DO UPDATE SET last_value = GREATEST(code_sequences.last_value, EXCLUDED.last_value)`;
  }
}

// Un pedido de Acme despachado en parte, con su despacho y su factura escritos como los
// escribiria el sistema: 2 cajas de agua salen al promedio de 0,50 y el agua pasa de 336 a 288. En
// Globex, lo que ataca la matriz de aislamiento.
async function seedSales(prisma: PrismaClient): Promise<void> {
  const { acme, globex } = CATALOG;
  const at = (day: string) => new Date(`${day}T12:00:00.000Z`);
  const date = (day: string) => new Date(`${day}T00:00:00.000Z`);

  await prisma.customer.createMany({
    data: [
      {
        id: SALES.acme.delta, tenantId: ACME, code: 'CLI000001', name: 'Comercial Delta', fiscalId: 'J-40123456-7',
        email: 'compras@delta.com', phone: '+58 212 555 0202', address: 'Calle Real de Sabana Grande', paymentTermDays: 15, creditLimit: 1000,
      },
      { id: SALES.acme.corner, tenantId: ACME, code: 'CLI000002', name: 'Bodegón La Esquina', paymentTermDays: 0 },
      {
        id: SALES.acme.farmacia, tenantId: ACME, code: 'CLI000003', name: 'Farmacia San Rafael', fiscalId: 'J-40987654-3',
        email: 'administracion@farmaciasanrafael.com', phone: '+58 212 555 0303', address: 'Av. Andrés Bello, La Candelaria', paymentTermDays: 30, creditLimit: 2000,
      },
      { id: SALES.globex.customer, tenantId: GLOBEX, code: 'CLI000001', name: 'Talleres Omega', paymentTermDays: 30, creditLimit: 500 },
    ],
  });

  const orders = [
    {
      id: SALES.acme.partialOrder, tenantId: ACME, code: 'PED000001', customerId: SALES.acme.delta, warehouseId: acme.warehouses.main,
      orderDate: date('2026-09-06'), notes: 'Pedido semanal', ...dollarsAt(150.25), status: 'partially_dispatched' as const, confirmedAt: at('2026-09-06'),
      lines: [
        { id: SALES.acme.partialWater, itemId: acme.items.water, unitId: acme.units.box, quantity: 5, baseQuantity: 120, unitPrice: 30, taxRate: 16, dispatchedQuantity: 2 },
        { id: SALES.acme.partialDetergent, itemId: acme.items.detergent, unitId: acme.units.kilo, quantity: 10, baseQuantity: 10, unitPrice: 5.5, taxRate: 16, dispatchedQuantity: 0 },
      ],
    },
    {
      id: SALES.acme.draftOrder, tenantId: ACME, code: 'PED000002', customerId: SALES.acme.corner, warehouseId: acme.warehouses.main,
      orderDate: date('2026-09-08'), notes: null, ...dollarsAt(152.4), status: 'draft' as const, confirmedAt: null,
      lines: [{ id: SALES.acme.draftWater, itemId: acme.items.water, unitId: acme.units.piece, quantity: 24, baseQuantity: 24, unitPrice: 1.5, taxRate: 16, dispatchedQuantity: 0 }],
    },
    {
      id: SALES.acme.cornerOrder, tenantId: ACME, code: 'PED000003', customerId: SALES.acme.corner, warehouseId: acme.warehouses.main,
      orderDate: date('2026-09-06'), notes: 'Pedido de jabón', ...dollarsAt(150.25), status: 'dispatched' as const, confirmedAt: at('2026-09-06'),
      lines: [{ id: SALES.acme.cornerOrderSoap, itemId: acme.items.soap, unitId: acme.units.piece, quantity: 10, baseQuantity: 10, unitPrice: 4.0, taxRate: 16, dispatchedQuantity: 10 }],
    },
    {
      id: SALES.acme.farmaciaOrder1, tenantId: ACME, code: 'PED000004', customerId: SALES.acme.farmacia, warehouseId: acme.warehouses.main,
      orderDate: date('2026-09-06'), notes: 'Pedido farmacia 1', ...dollarsAt(150.25), status: 'dispatched' as const, confirmedAt: at('2026-09-06'),
      lines: [{ id: SALES.acme.farmaciaOrder1Soap, itemId: acme.items.soap, unitId: acme.units.piece, quantity: 10, baseQuantity: 10, unitPrice: 4.0, taxRate: 16, dispatchedQuantity: 10 }],
    },
    {
      id: SALES.acme.farmaciaOrder2, tenantId: ACME, code: 'PED000005', customerId: SALES.acme.farmacia, warehouseId: acme.warehouses.main,
      orderDate: date('2026-09-06'), notes: 'Pedido farmacia 2', ...dollarsAt(150.25), status: 'dispatched' as const, confirmedAt: at('2026-09-06'),
      lines: [{ id: SALES.acme.farmaciaOrder2Soap, itemId: acme.items.soap, unitId: acme.units.piece, quantity: 10, baseQuantity: 10, unitPrice: 4.0, taxRate: 16, dispatchedQuantity: 10 }],
    },
    {
      id: SALES.acme.farmaciaOrder3, tenantId: ACME, code: 'PED000006', customerId: SALES.acme.farmacia, warehouseId: acme.warehouses.main,
      orderDate: date('2026-09-06'), notes: 'Pedido farmacia 3', ...dollarsAt(150.25), status: 'dispatched' as const, confirmedAt: at('2026-09-06'),
      lines: [{ id: SALES.acme.farmaciaOrder3Soap, itemId: acme.items.soap, unitId: acme.units.piece, quantity: 1, baseQuantity: 1, unitPrice: 4.0, taxRate: 16, dispatchedQuantity: 1 }],
    },
    {
      id: SALES.acme.farmaciaOrder4, tenantId: ACME, code: 'PED000007', customerId: SALES.acme.farmacia, warehouseId: acme.warehouses.main,
      orderDate: date('2026-09-06'), notes: 'Pedido farmacia 4', ...dollarsAt(150.25), status: 'dispatched' as const, confirmedAt: at('2026-09-06'),
      lines: [{ id: SALES.acme.farmaciaOrder4Soap, itemId: acme.items.soap, unitId: acme.units.piece, quantity: 2, baseQuantity: 2, unitPrice: 4.0, taxRate: 16, dispatchedQuantity: 2 }],
    },
    {
      id: SALES.globex.partialOrder, tenantId: GLOBEX, code: 'PED000001', customerId: SALES.globex.customer, warehouseId: globex.warehouses.main,
      orderDate: date('2026-09-05'), notes: null, ...dollarsAt(141), status: 'partially_dispatched' as const, confirmedAt: at('2026-09-05'),
      lines: [{ id: SALES.globex.partialFilter, itemId: globex.items.filter, unitId: globex.units.piece, quantity: 10, baseQuantity: 10, unitPrice: 14, taxRate: 16, dispatchedQuantity: 5 }],
    },
    {
      id: SALES.globex.draftOrder, tenantId: GLOBEX, code: 'PED000002', customerId: SALES.globex.customer, warehouseId: globex.warehouses.main,
      orderDate: date('2026-09-07'), notes: null, ...dollarsAt(141), status: 'draft' as const, confirmedAt: null,
      lines: [{ id: SALES.globex.draftFilter, itemId: globex.items.filter, unitId: globex.units.piece, quantity: 3, baseQuantity: 3, unitPrice: 14, taxRate: 16, dispatchedQuantity: 0 }],
    },
  ];

  for (const { lines, ...order } of orders) {
    await prisma.salesOrder.create({ data: { ...order, createdAt: order.orderDate, updatedAt: order.confirmedAt ?? order.orderDate } });
    await prisma.salesOrderLine.createMany({ data: lines.map((line, index) => ({ ...line, ...labelsOf(line.itemId), tenantId: order.tenantId, orderId: order.id, lineNumber: index + 1 })) });
  }

  const dispatches = [
    {
      id: SALES.acme.dispatch, tenantId: ACME, code: 'DES000001', orderId: SALES.acme.partialOrder, warehouseId: acme.warehouses.main,
      dispatchDate: date('2026-09-07'), notes: 'Primera entrega', status: 'confirmed' as const, confirmedAt: at('2026-09-07'),
      lines: [{ id: SALES.acme.dispatchWater, orderLineId: SALES.acme.partialWater, itemId: acme.items.water, unitId: acme.units.box, quantity: 2, baseQuantity: 48 }],
    },
    {
      id: SALES.acme.cornerDispatch, tenantId: ACME, code: 'DES000002', orderId: SALES.acme.cornerOrder, warehouseId: acme.warehouses.main,
      dispatchDate: date('2026-09-07'), notes: 'Entrega Bodegón', status: 'confirmed' as const, confirmedAt: at('2026-09-07'),
      lines: [{ id: SALES.acme.cornerDispatchSoap, orderLineId: SALES.acme.cornerOrderSoap, itemId: acme.items.soap, unitId: acme.units.piece, quantity: 10, baseQuantity: 10 }],
    },
    {
      id: SALES.acme.farmaciaDispatch1, tenantId: ACME, code: 'DES000003', orderId: SALES.acme.farmaciaOrder1, warehouseId: acme.warehouses.main,
      dispatchDate: date('2026-09-07'), notes: 'Entrega Farmacia 1', status: 'confirmed' as const, confirmedAt: at('2026-09-07'),
      lines: [{ id: SALES.acme.farmaciaDispatch1Soap, orderLineId: SALES.acme.farmaciaOrder1Soap, itemId: acme.items.soap, unitId: acme.units.piece, quantity: 10, baseQuantity: 10 }],
    },
    {
      id: SALES.acme.farmaciaDispatch2, tenantId: ACME, code: 'DES000004', orderId: SALES.acme.farmaciaOrder2, warehouseId: acme.warehouses.main,
      dispatchDate: date('2026-09-07'), notes: 'Entrega Farmacia 2', status: 'confirmed' as const, confirmedAt: at('2026-09-07'),
      lines: [{ id: SALES.acme.farmaciaDispatch2Soap, orderLineId: SALES.acme.farmaciaOrder2Soap, itemId: acme.items.soap, unitId: acme.units.piece, quantity: 10, baseQuantity: 10 }],
    },
    {
      id: SALES.acme.farmaciaDispatch3, tenantId: ACME, code: 'DES000005', orderId: SALES.acme.farmaciaOrder3, warehouseId: acme.warehouses.main,
      dispatchDate: date('2026-09-07'), notes: 'Entrega Farmacia 3', status: 'confirmed' as const, confirmedAt: at('2026-09-07'),
      lines: [{ id: SALES.acme.farmaciaDispatch3Soap, orderLineId: SALES.acme.farmaciaOrder3Soap, itemId: acme.items.soap, unitId: acme.units.piece, quantity: 1, baseQuantity: 1 }],
    },
    {
      id: SALES.acme.farmaciaDispatch4, tenantId: ACME, code: 'DES000006', orderId: SALES.acme.farmaciaOrder4, warehouseId: acme.warehouses.main,
      dispatchDate: date('2026-09-07'), notes: 'Entrega Farmacia 4', status: 'confirmed' as const, confirmedAt: at('2026-09-07'),
      lines: [{ id: SALES.acme.farmaciaDispatch4Soap, orderLineId: SALES.acme.farmaciaOrder4Soap, itemId: acme.items.soap, unitId: acme.units.piece, quantity: 2, baseQuantity: 2 }],
    },
    {
      id: SALES.globex.dispatch, tenantId: GLOBEX, code: 'DES000001', orderId: SALES.globex.partialOrder, warehouseId: globex.warehouses.main,
      dispatchDate: date('2026-09-06'), notes: null, status: 'confirmed' as const, confirmedAt: at('2026-09-06'),
      lines: [{ id: SALES.globex.dispatchFilter, orderLineId: SALES.globex.partialFilter, itemId: globex.items.filter, unitId: globex.units.piece, quantity: 5, baseQuantity: 5 }],
    },
    {
      id: SALES.globex.draftDispatch, tenantId: GLOBEX, code: 'DES000002', orderId: SALES.globex.partialOrder, warehouseId: globex.warehouses.main,
      dispatchDate: date('2026-09-08'), notes: null, status: 'draft' as const, confirmedAt: null,
      lines: [{ id: SALES.globex.draftDispatchFilter, orderLineId: SALES.globex.partialFilter, itemId: globex.items.filter, unitId: globex.units.piece, quantity: 2, baseQuantity: 2 }],
    },
  ];

  for (const { lines, ...dispatch } of dispatches) {
    await prisma.dispatch.create({ data: { ...dispatch, createdAt: dispatch.dispatchDate, updatedAt: dispatch.confirmedAt ?? dispatch.dispatchDate } });
    await prisma.dispatchLine.createMany({ data: lines.map((line, index) => ({ ...line, ...labelsOf(line.itemId), tenantId: dispatch.tenantId, dispatchId: dispatch.id, lineNumber: index + 1 })) });
  }

  const invoices = [
    {
      id: SALES.acme.invoice, tenantId: ACME, code: 'FAC000001', dispatchId: SALES.acme.dispatch, orderId: SALES.acme.partialOrder, customerId: SALES.acme.delta,
      issueDate: date('2026-09-07'), dueDate: date('2026-09-22'), subtotal: 60, tax: 9.6, total: 69.6,
      ...dollarsAt(150.25), subtotalVes: 9015, taxVes: 1442.4, totalVes: 10457.4,
      line: { id: SALES.acme.invoiceWater, orderLineId: SALES.acme.partialWater, itemId: acme.items.water, unitId: acme.units.box, quantity: 2, unitPrice: 30, taxRate: 16, subtotal: 60, tax: 9.6 },
    },
    {
      id: SALES.acme.cornerInvoice, tenantId: ACME, code: 'FAC000002', dispatchId: SALES.acme.cornerDispatch, orderId: SALES.acme.cornerOrder, customerId: SALES.acme.corner,
      issueDate: date('2026-09-07'), dueDate: date('2026-09-22'), subtotal: 40, tax: 6.4, total: 46.4,
      ...dollarsAt(150.25), subtotalVes: 6010, taxVes: 961.6, totalVes: 6971.6,
      line: { id: SALES.acme.cornerInvoiceSoap, orderLineId: SALES.acme.cornerOrderSoap, itemId: acme.items.soap, unitId: acme.units.piece, quantity: 10, unitPrice: 4.0, taxRate: 16, subtotal: 40, tax: 6.4 },
    },
    {
      id: SALES.acme.farmaciaInvoice1, tenantId: ACME, code: 'FAC000003', dispatchId: SALES.acme.farmaciaDispatch1, orderId: SALES.acme.farmaciaOrder1, customerId: SALES.acme.farmacia,
      issueDate: date('2026-09-07'), dueDate: date('2026-09-22'), subtotal: 40, tax: 6.4, total: 46.4,
      ...dollarsAt(150.25), subtotalVes: 6010, taxVes: 961.6, totalVes: 6971.6,
      line: { id: SALES.acme.farmaciaInvoice1Soap, orderLineId: SALES.acme.farmaciaOrder1Soap, itemId: acme.items.soap, unitId: acme.units.piece, quantity: 10, unitPrice: 4.0, taxRate: 16, subtotal: 40, tax: 6.4 },
    },
    {
      id: SALES.acme.farmaciaInvoice2, tenantId: ACME, code: 'FAC000004', dispatchId: SALES.acme.farmaciaDispatch2, orderId: SALES.acme.farmaciaOrder2, customerId: SALES.acme.farmacia,
      issueDate: date('2026-09-07'), dueDate: date('2026-09-22'), subtotal: 40, tax: 6.4, total: 46.4,
      ...dollarsAt(150.25), subtotalVes: 6010, taxVes: 961.6, totalVes: 6971.6,
      line: { id: SALES.acme.farmaciaInvoice2Soap, orderLineId: SALES.acme.farmaciaOrder2Soap, itemId: acme.items.soap, unitId: acme.units.piece, quantity: 10, unitPrice: 4.0, taxRate: 16, subtotal: 40, tax: 6.4 },
    },
    {
      id: SALES.acme.farmaciaInvoice3, tenantId: ACME, code: 'FAC000005', dispatchId: SALES.acme.farmaciaDispatch3, orderId: SALES.acme.farmaciaOrder3, customerId: SALES.acme.farmacia,
      issueDate: date('2026-09-07'), dueDate: date('2026-09-22'), subtotal: 4.0, tax: 0.64, total: 4.64,
      ...dollarsAt(150.25), subtotalVes: 601, taxVes: 96.16, totalVes: 697.16,
      line: { id: SALES.acme.farmaciaInvoice3Soap, orderLineId: SALES.acme.farmaciaOrder3Soap, itemId: acme.items.soap, unitId: acme.units.piece, quantity: 1, unitPrice: 4.0, taxRate: 16, subtotal: 4.0, tax: 0.64 },
    },
    {
      id: SALES.acme.farmaciaInvoice4, tenantId: ACME, code: 'FAC000006', dispatchId: SALES.acme.farmaciaDispatch4, orderId: SALES.acme.farmaciaOrder4, customerId: SALES.acme.farmacia,
      issueDate: date('2026-09-07'), dueDate: date('2026-09-22'), subtotal: 8.0, tax: 1.28, total: 9.28,
      ...dollarsAt(150.25), subtotalVes: 1202, taxVes: 192.32, totalVes: 1394.32,
      line: { id: SALES.acme.farmaciaInvoice4Soap, orderLineId: SALES.acme.farmaciaOrder4Soap, itemId: acme.items.soap, unitId: acme.units.piece, quantity: 2, unitPrice: 4.0, taxRate: 16, subtotal: 8.0, tax: 1.28 },
    },
    {
      id: SALES.globex.invoice, tenantId: GLOBEX, code: 'FAC000001', dispatchId: SALES.globex.dispatch, orderId: SALES.globex.partialOrder, customerId: SALES.globex.customer,
      issueDate: date('2026-09-06'), dueDate: date('2026-10-06'), subtotal: 70, tax: 11.2, total: 81.2,
      ...dollarsAt(141), subtotalVes: 9870, taxVes: 1579.2, totalVes: 11449.2,
      line: { id: SALES.globex.invoiceFilter, orderLineId: SALES.globex.partialFilter, itemId: globex.items.filter, unitId: globex.units.piece, quantity: 5, unitPrice: 14, taxRate: 16, subtotal: 70, tax: 11.2 },
    },
  ];

  for (const { line, ...invoice } of invoices) {
    await prisma.invoice.create({ data: { ...invoice, status: 'issued', createdAt: invoice.issueDate, updatedAt: invoice.issueDate } });
    await prisma.invoiceLine.create({ data: { ...line, ...labelsOf(line.itemId), tenantId: invoice.tenantId, invoiceId: invoice.id, lineNumber: 1 } });
  }

  const exits = [
    { id: SALES.acme.dispatchMovement, tenantId: ACME, itemId: acme.items.water, warehouseId: acme.warehouses.main, sequence: 3, quantity: 48, cost: 0.5, balance: 288, originId: SALES.acme.dispatch, lineId: SALES.acme.dispatchWater, day: '2026-09-07' },
    { id: SALES.acme.cornerDispatchMovement, tenantId: ACME, itemId: acme.items.soap, warehouseId: acme.warehouses.main, sequence: 4, quantity: 10, cost: 1.5, balance: 106, originId: SALES.acme.cornerDispatch, lineId: SALES.acme.cornerDispatchSoap, day: '2026-09-07' },
    { id: SALES.acme.farmaciaDispatch1Movement, tenantId: ACME, itemId: acme.items.soap, warehouseId: acme.warehouses.main, sequence: 5, quantity: 10, cost: 1.5, balance: 96, originId: SALES.acme.farmaciaDispatch1, lineId: SALES.acme.farmaciaDispatch1Soap, day: '2026-09-07' },
    { id: SALES.acme.farmaciaDispatch2Movement, tenantId: ACME, itemId: acme.items.soap, warehouseId: acme.warehouses.main, sequence: 6, quantity: 10, cost: 1.5, balance: 86, originId: SALES.acme.farmaciaDispatch2, lineId: SALES.acme.farmaciaDispatch2Soap, day: '2026-09-07' },
    { id: SALES.acme.farmaciaDispatch3Movement, tenantId: ACME, itemId: acme.items.soap, warehouseId: acme.warehouses.main, sequence: 7, quantity: 1, cost: 1.5, balance: 85, originId: SALES.acme.farmaciaDispatch3, lineId: SALES.acme.farmaciaDispatch3Soap, day: '2026-09-07' },
    { id: SALES.acme.farmaciaDispatch4Movement, tenantId: ACME, itemId: acme.items.soap, warehouseId: acme.warehouses.main, sequence: 8, quantity: 2, cost: 1.5, balance: 83, originId: SALES.acme.farmaciaDispatch4, lineId: SALES.acme.farmaciaDispatch4Soap, day: '2026-09-07' },
    { id: SALES.globex.dispatchMovement, tenantId: GLOBEX, itemId: globex.items.filter, warehouseId: globex.warehouses.main, sequence: 3, quantity: 5, cost: 8.5, balance: 25, originId: SALES.globex.dispatch, lineId: SALES.globex.dispatchFilter, day: '2026-09-06' },
  ];

  for (const exit of exits) {
    await prisma.inventoryMovement.create({
      data: {
        id: exit.id, tenantId: exit.tenantId, itemId: exit.itemId, warehouseId: exit.warehouseId, sequence: exit.sequence, direction: 'out',
        quantity: exit.quantity, unitCost: exit.cost, balanceQuantity: exit.balance, balanceAverageCost: exit.cost, originType: 'dispatch',
        originId: exit.originId, originLineId: exit.lineId, originDate: at(exit.day), occurredAt: at(exit.day),
      },
    });
    await prisma.itemStock.update({
      where: { tenantId_itemId_warehouseId: { tenantId: exit.tenantId, itemId: exit.itemId, warehouseId: exit.warehouseId } },
      data: { quantity: exit.balance, lastSequence: exit.sequence, updatedAt: at(exit.day) },
    });
  }

  // H8 Caso 1: Devolucion de venta sin nota (DVV000001, resalable)
  await prisma.salesReturn.create({
    data: {
      id: SALES.acme.salesReturn1,
      tenantId: ACME,
      code: 'DVV000001',
      customerId: SALES.acme.corner,
      dispatchId: SALES.acme.cornerDispatch,
      warehouseId: acme.warehouses.main,
      returnDate: date('2026-09-08'),
      condition: 'resalable',
      reason: 'Sobró pedido',
      notes: 'Mercancía en perfecto estado, reingresa a bodega',
      status: 'confirmed',
      confirmedAt: at('2026-09-08'),
      ...dollarsAt(152.4),
      createdAt: at('2026-09-08'),
      updatedAt: at('2026-09-08'),
    },
  });
  await prisma.salesReturnLine.create({
    data: {
      id: SALES.acme.salesReturn1Line,
      tenantId: ACME,
      salesReturnId: SALES.acme.salesReturn1,
      dispatchLineId: SALES.acme.cornerDispatchSoap,
      lineNumber: 1,
      itemId: acme.items.soap,
      ...labelsOf(acme.items.soap),
      unitId: acme.units.piece,
      quantity: 2,
      baseQuantity: 2,
      unitCost: 1.5,
      restoresMovementId: SALES.acme.cornerDispatchMovement,
    },
  });
  await prisma.inventoryMovement.create({
    data: {
      id: SALES.acme.salesReturn1Movement,
      tenantId: ACME,
      itemId: acme.items.soap,
      warehouseId: acme.warehouses.main,
      sequence: 9,
      direction: 'in',
      quantity: 2,
      unitCost: 1.5,
      balanceQuantity: 85,
      balanceAverageCost: 1.5,
      originType: 'sales_return',
      originId: SALES.acme.salesReturn1,
      originLineId: SALES.acme.salesReturn1Line,
      restoresMovementId: SALES.acme.cornerDispatchMovement,
      originDate: at('2026-09-08'),
      occurredAt: at('2026-09-08'),
    },
  });
  await prisma.itemStock.update({
    where: { tenantId_itemId_warehouseId: { tenantId: ACME, itemId: acme.items.soap, warehouseId: acme.warehouses.main } },
    data: { quantity: 85, lastSequence: 9, updatedAt: at('2026-09-08') },
  });

  // H8 Caso 3: Devolucion de venta scrap (DVV000002) - NO genera movimiento en kardex
  await prisma.salesReturn.create({
    data: {
      id: SALES.acme.salesReturn2,
      tenantId: ACME,
      code: 'DVV000002',
      customerId: SALES.acme.farmacia,
      dispatchId: SALES.acme.farmaciaDispatch2,
      warehouseId: acme.warehouses.main,
      returnDate: date('2026-09-08'),
      condition: 'scrap',
      reason: 'Producto roto en traslado',
      notes: 'Mercancía destruida, no reingresa a inventario',
      status: 'confirmed',
      confirmedAt: at('2026-09-08'),
      ...dollarsAt(152.4),
      createdAt: at('2026-09-08'),
      updatedAt: at('2026-09-08'),
    },
  });
  await prisma.salesReturnLine.create({
    data: {
      id: SALES.acme.salesReturn2Line,
      tenantId: ACME,
      salesReturnId: SALES.acme.salesReturn2,
      dispatchLineId: SALES.acme.farmaciaDispatch2Soap,
      lineNumber: 1,
      itemId: acme.items.soap,
      ...labelsOf(acme.items.soap),
      unitId: acme.units.piece,
      quantity: 3,
      baseQuantity: 3,
      unitCost: 1.5,
      restoresMovementId: SALES.acme.farmaciaDispatch2Movement,
    },
  });

  for (const [tenantId, prefix, lastValue] of [
    [ACME, 'CLI', 3], [ACME, 'PED', 7], [ACME, 'DES', 6], [ACME, 'FAC', 6], [ACME, 'DVV', 2],
    [GLOBEX, 'CLI', 1], [GLOBEX, 'PED', 2], [GLOBEX, 'DES', 2], [GLOBEX, 'FAC', 1],
  ] as const) {
    await prisma.$executeRaw`
      INSERT INTO code_sequences (tenant_id, prefix, last_value)
      VALUES (${tenantId}::uuid, ${prefix}, ${lastValue})
      ON CONFLICT (tenant_id, prefix)
      DO UPDATE SET last_value = GREATEST(code_sequences.last_value, EXCLUDED.last_value)`;
  }
}

// Delta abono 30 a su factura de 69,60, que queda con 39,60 por cobrar. Globex tiene un cobro
// confirmado y un borrador: son los blancos de la matriz de aislamiento.
// H8: Notas de credito y cobros por credit_note de Acme.
async function seedReceivables(prisma: PrismaClient): Promise<void> {
  const { acme } = CATALOG;
  const at = (day: string) => new Date(`${day}T12:00:00.000Z`);
  const date = (day: string) => new Date(`${day}T00:00:00.000Z`);

  const payments = [
    {
      id: SALES.acme.payment, tenantId: ACME, code: 'COB000001', customerId: SALES.acme.delta, paymentDate: date('2026-09-10'), method: 'transfer' as const,
      reference: 'TRF-88231', amount: 30, ...dollarsAt(152.4), amountVes: 4572, difference: 64.5, status: 'confirmed' as const, confirmedAt: at('2026-09-10'),
      creditSourceId: null, allocation: { id: SALES.acme.paymentAllocation, invoiceId: SALES.acme.invoice },
    },
    // H8 Caso 2: Cobro de emision de NCC000001 aplicado a FAC000003
    {
      id: SALES.acme.issuePayment1, tenantId: ACME, code: 'COB000002', customerId: SALES.acme.farmacia, paymentDate: date('2026-09-08'), method: 'credit_note' as const,
      reference: null, amount: 11.60, ...dollarsAt(152.4), amountVes: 1767.84, difference: 24.94, status: 'confirmed' as const, confirmedAt: at('2026-09-08'),
      creditSourceId: SALES.acme.creditNote1, allocation: { id: SALES.acme.issuePayment1Allocation, invoiceId: SALES.acme.farmaciaInvoice1 },
    },
    // H8 Caso 3: Cobro de emision de NCC000002 aplicado a FAC000004
    {
      id: SALES.acme.issuePayment2, tenantId: ACME, code: 'COB000003', customerId: SALES.acme.farmacia, paymentDate: date('2026-09-08'), method: 'credit_note' as const,
      reference: null, amount: 13.92, ...dollarsAt(152.4), amountVes: 2121.41, difference: 29.93, status: 'confirmed' as const, confirmedAt: at('2026-09-08'),
      creditSourceId: SALES.acme.creditNote2, allocation: { id: SALES.acme.issuePayment2Allocation, invoiceId: SALES.acme.farmaciaInvoice2 },
    },
    // H8 Caso 4: Cobro de emision de NCC000003 aplicado a FAC000005 (topado a su saldo vivo de 4.64)
    {
      id: SALES.acme.issuePayment3, tenantId: ACME, code: 'COB000004', customerId: SALES.acme.farmacia, paymentDate: date('2026-09-08'), method: 'credit_note' as const,
      reference: null, amount: 4.64, ...dollarsAt(152.4), amountVes: 707.14, difference: 9.98, status: 'confirmed' as const, confirmedAt: at('2026-09-08'),
      creditSourceId: SALES.acme.creditNote3, allocation: { id: SALES.acme.issuePayment3Allocation, invoiceId: SALES.acme.farmaciaInvoice3 },
    },
    // H8 Caso 4: Cobro posterior desde Cobros que gasta 5.00 del credito disponible en FAC000006
    {
      id: SALES.acme.appliedPayment, tenantId: ACME, code: 'COB000005', customerId: SALES.acme.farmacia, paymentDate: date('2026-09-09'), method: 'credit_note' as const,
      reference: null, amount: 5.00, ...dollarsAt(152.4), amountVes: 762.00, difference: 10.75, status: 'confirmed' as const, confirmedAt: at('2026-09-09'),
      creditSourceId: SALES.acme.creditNote3, allocation: { id: SALES.acme.appliedPaymentAllocation, invoiceId: SALES.acme.farmaciaInvoice4 },
    },
    {
      id: SALES.globex.confirmedPayment, tenantId: GLOBEX, code: 'COB000001', customerId: SALES.globex.customer, paymentDate: date('2026-09-08'), method: 'cash' as const,
      reference: null, amount: 20, ...dollarsAt(141), amountVes: 2820, difference: 0, status: 'confirmed' as const, confirmedAt: at('2026-09-08'),
      creditSourceId: null, allocation: { id: SALES.globex.confirmedAllocation, invoiceId: SALES.globex.invoice },
    },
    {
      id: SALES.globex.draftPayment, tenantId: GLOBEX, code: 'COB000002', customerId: SALES.globex.customer, paymentDate: date('2026-09-09'), method: 'transfer' as const,
      reference: null, amount: 10, ...dollarsAt(141), amountVes: 1410, difference: 0, status: 'draft' as const, confirmedAt: null,
      creditSourceId: null, allocation: { id: SALES.globex.draftAllocation, invoiceId: SALES.globex.invoice },
    },
  ];

  // Las notas de credito se crean ANTES de los cobros para que los cobros puedan referenciar creditSourceId,
  // y luego se actualiza issuePaymentId en las notas.
  const creditNotes = [
    // H8 Caso 2: Nota de credito sin devolucion (descuento posterior)
    {
      id: SALES.acme.creditNote1, tenantId: ACME, code: 'NCC000001', customerId: SALES.acme.farmacia,
      invoiceId: SALES.acme.farmaciaInvoice1, salesReturnId: null, issuePaymentId: SALES.acme.issuePayment1,
      issueDate: date('2026-09-08'), reason: 'subsequent_discount' as const, reasonDetail: null, notes: 'Descuento por pronto pago',
      status: 'confirmed' as const, subtotal: 10.0, tax: 1.6, total: 11.60,
      ...dollarsAt(152.4), subtotalVes: 1524, taxVes: 243.84, totalVes: 1767.84, confirmedAt: at('2026-09-08'),
      line: { id: SALES.acme.creditNote1Line, lineNumber: 1, concept: 'Descuento comercial', itemId: null, unitId: null, quantity: 1, unitPrice: 10.0, taxRate: 16, subtotal: 10.0, tax: 1.6, total: 11.60 },
    },
    // H8 Caso 3: Nota de credito que acredita devolucion scrap
    {
      id: SALES.acme.creditNote2, tenantId: ACME, code: 'NCC000002', customerId: SALES.acme.farmacia,
      invoiceId: SALES.acme.farmaciaInvoice2, salesReturnId: SALES.acme.salesReturn2, issuePaymentId: SALES.acme.issuePayment2,
      issueDate: date('2026-09-08'), reason: 'damaged_goods' as const, reasonDetail: null, notes: 'Mercancía dañada',
      status: 'confirmed' as const, subtotal: 12.0, tax: 1.92, total: 13.92,
      ...dollarsAt(152.4), subtotalVes: 1828.8, taxVes: 292.61, totalVes: 2121.41, confirmedAt: at('2026-09-08'),
      line: { id: SALES.acme.creditNote2Line, lineNumber: 1, concept: null, itemId: acme.items.soap, unitId: acme.units.piece, quantity: 3, unitPrice: 4.0, taxRate: 16, subtotal: 12.0, tax: 1.92, total: 13.92 },
    },
    // H8 Caso 4: Nota de credito con credito sobrante gastado desde Cobros
    {
      id: SALES.acme.creditNote3, tenantId: ACME, code: 'NCC000003', customerId: SALES.acme.farmacia,
      invoiceId: SALES.acme.farmaciaInvoice3, salesReturnId: null, issuePaymentId: SALES.acme.issuePayment3,
      issueDate: date('2026-09-08'), reason: 'price_correction' as const, reasonDetail: null, notes: 'Ajuste de precio con saldo a favor',
      status: 'confirmed' as const, subtotal: 10.0, tax: 1.6, total: 11.60,
      ...dollarsAt(152.4), subtotalVes: 1524, taxVes: 243.84, totalVes: 1767.84, confirmedAt: at('2026-09-08'),
      line: { id: SALES.acme.creditNote3Line, lineNumber: 1, concept: 'Corrección de precio acordada', itemId: null, unitId: null, quantity: 1, unitPrice: 10.0, taxRate: 16, subtotal: 10.0, tax: 1.6, total: 11.60 },
    },
  ];

  for (const { line, ...creditNote } of creditNotes) {
    // Se crea inicialmente con issuePaymentId nulo para satisfacer la FK hacia customer_payments
    await prisma.customerCreditNote.create({
      data: { ...creditNote, issuePaymentId: null, createdAt: creditNote.issueDate, updatedAt: creditNote.confirmedAt ?? creditNote.issueDate },
    });
    await prisma.customerCreditNoteLine.create({
      data: {
        ...line,
        ...(line.itemId ? labelsOf(line.itemId) : { itemSku: null, itemName: null }),
        tenantId: creditNote.tenantId,
        creditNoteId: creditNote.id,
      },
    });
  }

  for (const { allocation, difference, ...payment } of payments) {
    await prisma.customerPayment.create({ data: { ...payment, createdAt: payment.paymentDate, updatedAt: payment.confirmedAt ?? payment.paymentDate } });
    await prisma.paymentAllocation.create({
      data: { ...allocation, tenantId: payment.tenantId, paymentId: payment.id, amount: payment.amount, exchangeRate: payment.exchangeRate, exchangeDifference: difference },
    });
  }

  // Ahora se enlazan los cobros de emision en las notas de credito
  for (const creditNote of creditNotes) {
    if (creditNote.issuePaymentId) {
      await prisma.customerCreditNote.update({
        where: { tenantId_id: { tenantId: creditNote.tenantId, id: creditNote.id } },
        data: { issuePaymentId: creditNote.issuePaymentId },
      });
    }
  }

  for (const [tenantId, lastValue] of [
    [ACME, 5],
    [GLOBEX, 2],
  ] as const) {
    await prisma.$executeRaw`
      INSERT INTO code_sequences (tenant_id, prefix, last_value)
      VALUES (${tenantId}::uuid, 'COB', ${lastValue})
      ON CONFLICT (tenant_id, prefix)
      DO UPDATE SET last_value = GREATEST(code_sequences.last_value, EXCLUDED.last_value)`;
  }

  for (const [tenantId, lastValue] of [
    [ACME, 3],
    [GLOBEX, 0],
  ] as const) {
    await prisma.$executeRaw`
      INSERT INTO code_sequences (tenant_id, prefix, last_value)
      VALUES (${tenantId}::uuid, 'NCC', ${lastValue})
      ON CONFLICT (tenant_id, prefix)
      DO UPDATE SET last_value = GREATEST(code_sequences.last_value, EXCLUDED.last_value)`;
  }
}

// Cuentas por pagar de ejemplo (H9):
// Facturas de compra (FCP), notas de credito (NCP), pagos (PAG) y revaluaciones de inventario (AJU).
async function seedPayables(prisma: PrismaClient): Promise<void> {
  const { acme, globex } = CATALOG;
  const at = (day: string) => new Date(`${day}T12:00:00.000Z`);
  const date = (day: string) => new Date(`${day}T00:00:00.000Z`);

  // Facturas de compra de Acme y Globex
  const invoices = [
    // H9 Caso 1: Factura más cara con revaluación en borrador (FCP000001)
    {
      id: PAYABLES.acme.invoice1,
      tenantId: ACME,
      code: 'FCP000001',
      supplierId: PURCHASING.acme.andina,
      supplierInvoiceNumber: 'INV-AND-001',
      supplierInvoiceSeries: null,
      issueDate: date('2026-09-06'),
      dueDate: date('2026-10-06'),
      notes: 'Factura con sobreprecio en agua mineral',
      status: 'confirmed' as const,
      subtotal: 60.0,
      tax: 9.6,
      total: 69.6,
      priceDifference: 12.0,
      exchangeDifference: 0,
      confirmedAt: at('2026-09-06'),
      ...dollarsAt(150.25),
      subtotalVes: 9015,
      taxVes: 1442.4,
      totalVes: 10457.4,
      lines: [
        {
          id: PAYABLES.acme.invoice1Line,
          lineNumber: 1,
          receiptLineId: PURCHASING.acme.receiptWater,
          orderLineId: PURCHASING.acme.partialWater,
          itemId: acme.items.water,
          itemSku: 'AGUA-500',
          itemName: 'Agua mineral 500 ml',
          concept: null,
          unitId: acme.units.box,
          quantity: 4,
          unitPrice: 15.0,
          taxRate: 16,
          subtotal: 60.0,
          tax: 9.6,
          total: 69.6,
        },
      ],
    },
    // H9 Caso 2: Factura más cara con revaluación aprobada (FCP000002)
    {
      id: PAYABLES.acme.invoice2,
      tenantId: ACME,
      code: 'FCP000002',
      supplierId: PURCHASING.acme.andina,
      supplierInvoiceNumber: 'INV-AND-002',
      supplierInvoiceSeries: null,
      issueDate: date('2026-09-04'),
      dueDate: date('2026-10-04'),
      notes: 'Factura en Norte con revaluación confirmada',
      status: 'confirmed' as const,
      subtotal: 35.0,
      tax: 5.6,
      total: 40.6,
      priceDifference: 5.0,
      exchangeDifference: 0,
      confirmedAt: at('2026-09-04'),
      ...dollarsAt(150.25),
      subtotalVes: 5258.75,
      taxVes: 841.4,
      totalVes: 6100.15,
      lines: [
        {
          id: PAYABLES.acme.invoice2Line,
          lineNumber: 1,
          receiptLineId: PURCHASING.acme.northReceiptLine,
          orderLineId: PURCHASING.acme.northOrderLine,
          itemId: acme.items.detergent,
          itemSku: 'DETERGENTE-1KG',
          itemName: 'Detergente en polvo 1 kg',
          concept: null,
          unitId: acme.units.kilo,
          quantity: 10,
          unitPrice: 3.5,
          taxRate: 16,
          subtotal: 35.0,
          tax: 5.6,
          total: 40.6,
        },
      ],
    },
    // H9 Caso 3: Factura que cita dos bodegas (FCP000003: main y north)
    {
      id: PAYABLES.acme.invoice3,
      tenantId: ACME,
      code: 'FCP000003',
      supplierId: PURCHASING.acme.andina,
      supplierInvoiceNumber: 'INV-AND-003',
      supplierInvoiceSeries: null,
      issueDate: date('2026-09-06'),
      dueDate: date('2026-10-06'),
      notes: 'Factura inter-bodegas',
      status: 'confirmed' as const,
      subtotal: 41.5,
      tax: 6.64,
      total: 48.14,
      priceDifference: 8.5,
      exchangeDifference: 0,
      confirmedAt: at('2026-09-06'),
      ...dollarsAt(150.25),
      subtotalVes: 6235.38,
      taxVes: 997.66,
      totalVes: 7233.04,
      lines: [
        {
          id: PAYABLES.acme.invoice3LineMain,
          lineNumber: 1,
          receiptLineId: PURCHASING.acme.interWarehouseWaterReceiptLine,
          orderLineId: PURCHASING.acme.interWarehouseWaterOrderLine,
          itemId: acme.items.water,
          itemSku: 'AGUA-500',
          itemName: 'Agua mineral 500 ml',
          concept: null,
          unitId: acme.units.box,
          quantity: 2,
          unitPrice: 14.0,
          taxRate: 16,
          subtotal: 28.0,
          tax: 4.48,
          total: 32.48,
        },
        {
          id: PAYABLES.acme.invoice3LineNorth,
          lineNumber: 2,
          receiptLineId: PURCHASING.acme.interWarehouseNorthReceiptLine,
          orderLineId: PURCHASING.acme.interWarehouseNorthOrderLine,
          itemId: acme.items.detergent,
          itemSku: 'DETERGENTE-1KG',
          itemName: 'Detergente en polvo 1 kg',
          concept: null,
          unitId: acme.units.kilo,
          quantity: 3,
          unitPrice: 4.5,
          taxRate: 16,
          subtotal: 13.5,
          tax: 2.16,
          total: 15.66,
        },
      ],
    },
    // H9 Caso 4: Servicio de una orden y gasto sin orden (FCP000004)
    {
      id: PAYABLES.acme.invoice4,
      tenantId: ACME,
      code: 'FCP000004',
      supplierId: PURCHASING.acme.andina,
      supplierInvoiceNumber: 'INV-AND-004',
      supplierInvoiceSeries: null,
      issueDate: date('2026-09-07'),
      dueDate: date('2026-10-07'),
      notes: 'Factura de servicios y transporte',
      status: 'confirmed' as const,
      subtotal: 30.0,
      tax: 4.8,
      total: 34.8,
      priceDifference: 0,
      exchangeDifference: 0,
      confirmedAt: at('2026-09-07'),
      ...dollarsAt(150.25),
      subtotalVes: 4507.5,
      taxVes: 721.2,
      totalVes: 5228.7,
      lines: [
        {
          id: PAYABLES.acme.invoice4LineService,
          lineNumber: 1,
          receiptLineId: null,
          orderLineId: PURCHASING.acme.serviceOrderLine,
          itemId: acme.items.delivery,
          itemSku: 'SERV-ENTREGA',
          itemName: 'Servicio de entrega',
          concept: null,
          unitId: acme.units.piece,
          quantity: 1,
          unitPrice: 20.0,
          taxRate: 16,
          subtotal: 20.0,
          tax: 3.2,
          total: 23.2,
        },
        {
          id: PAYABLES.acme.invoice4LineExpense,
          lineNumber: 2,
          receiptLineId: null,
          orderLineId: null,
          itemId: null,
          itemSku: null,
          itemName: 'Gastos de embalaje y transporte',
          concept: 'Gastos de embalaje y transporte',
          unitId: null,
          quantity: 1,
          unitPrice: 10.0,
          taxRate: 16,
          subtotal: 10.0,
          tax: 1.6,
          total: 11.6,
        },
      ],
    },
    // H9 Caso 5: Factura al mismo precio que su entrada (FCP000005, sin revaluación)
    {
      id: PAYABLES.acme.invoice5,
      tenantId: ACME,
      code: 'FCP000005',
      supplierId: PURCHASING.acme.valle,
      supplierInvoiceNumber: 'INV-VAL-001',
      supplierInvoiceSeries: null,
      issueDate: date('2026-09-04'),
      dueDate: date('2026-10-04'),
      notes: 'Factura conforme de jabón líquido',
      status: 'confirmed' as const,
      subtotal: 30.0,
      tax: 4.8,
      total: 34.8,
      priceDifference: 0,
      exchangeDifference: 0,
      confirmedAt: at('2026-09-04'),
      ...dollarsAt(150.25),
      subtotalVes: 4507.5,
      taxVes: 721.2,
      totalVes: 5228.7,
      lines: [
        {
          id: PAYABLES.acme.invoice5Line,
          lineNumber: 1,
          receiptLineId: PURCHASING.acme.soapReceiptLine,
          orderLineId: PURCHASING.acme.soapOrderLine,
          itemId: acme.items.soap,
          itemSku: 'JABON-500',
          itemName: 'Jabón líquido 500 ml',
          concept: null,
          unitId: acme.units.piece,
          quantity: 20,
          unitPrice: 1.5,
          taxRate: 16,
          subtotal: 30.0,
          tax: 4.8,
          total: 34.8,
        },
      ],
    },
    // Globex: Facturas para aislamiento
    {
      id: PAYABLES.globex.confirmedInvoice,
      tenantId: GLOBEX,
      code: 'FCP000001',
      supplierId: PURCHASING.globex.supplier,
      supplierInvoiceNumber: 'INV-GLX-001',
      supplierInvoiceSeries: null,
      issueDate: date('2026-09-05'),
      dueDate: date('2026-10-05'),
      notes: 'Factura taller',
      status: 'confirmed' as const,
      subtotal: 100.0,
      tax: 16.0,
      total: 116.0,
      priceDifference: 0,
      exchangeDifference: 0,
      confirmedAt: at('2026-09-05'),
      ...dollarsAt(141),
      subtotalVes: 14100,
      taxVes: 2256,
      totalVes: 16356,
      lines: [
        {
          id: PAYABLES.globex.confirmedInvoiceLine,
          lineNumber: 1,
          receiptLineId: PURCHASING.globex.receiptFilter,
          orderLineId: PURCHASING.globex.confirmedFilter,
          itemId: globex.items.filter,
          itemSku: 'FILTRO-ACEITE',
          itemName: 'Filtro de aceite',
          concept: null,
          unitId: globex.units.piece,
          quantity: 10,
          unitPrice: 10.0,
          taxRate: 16,
          subtotal: 100.0,
          tax: 16.0,
          total: 116.0,
        },
      ],
    },
    {
      id: PAYABLES.globex.draftInvoice,
      tenantId: GLOBEX,
      code: 'FCP000002',
      supplierId: PURCHASING.globex.supplier,
      supplierInvoiceNumber: 'INV-GLX-002',
      supplierInvoiceSeries: null,
      issueDate: date('2026-09-06'),
      dueDate: date('2026-10-06'),
      notes: 'Borrador para aislamiento',
      status: 'draft' as const,
      subtotal: 40.0,
      tax: 6.4,
      total: 46.4,
      priceDifference: 0,
      exchangeDifference: 0,
      confirmedAt: null,
      ...dollarsAt(141),
      subtotalVes: 5640,
      taxVes: 902.4,
      totalVes: 6542.4,
      lines: [
        {
          id: PAYABLES.globex.draftInvoiceLine,
          lineNumber: 1,
          receiptLineId: PURCHASING.globex.receiptFilter,
          orderLineId: PURCHASING.globex.confirmedFilter,
          itemId: globex.items.filter,
          itemSku: 'FILTRO-ACEITE',
          itemName: 'Filtro de aceite',
          concept: null,
          unitId: globex.units.piece,
          quantity: 4,
          unitPrice: 10.0,
          taxRate: 16,
          subtotal: 40.0,
          tax: 6.4,
          total: 46.4,
        },
      ],
    },
  ];

  for (const { lines, ...invoice } of invoices) {
    await prisma.purchaseInvoice.create({
      data: {
        ...invoice,
        createdAt: invoice.issueDate,
        updatedAt: invoice.confirmedAt ?? invoice.issueDate,
      },
    });
    await prisma.purchaseInvoiceLine.createMany({
      data: lines.map((l) => ({
        ...l,
        tenantId: invoice.tenantId,
        invoiceId: invoice.id,
      })),
    });
  }

  // Revaluaciones de inventario de Acme asociadas a las facturas
  const revaluations = [
    // AJU000003: Revaluación en borrador por FCP000001 (bodega main)
    {
      id: PAYABLES.acme.adjFcp1,
      tenantId: ACME,
      code: 'AJU000003',
      warehouseId: acme.warehouses.main,
      adjustmentDate: date('2026-09-06'),
      type: 'revaluation' as const,
      notes: 'Diferencia de precio segun factura FCP000001',
      status: 'draft' as const,
      createdBy: ANA,
      confirmedBy: null,
      confirmedAt: null,
      originType: 'purchase_invoice',
      originId: PAYABLES.acme.invoice1,
      lines: [
        {
          id: PAYABLES.acme.adjFcp1Line,
          lineNumber: 1,
          itemId: acme.items.water,
          itemSku: 'AGUA-500',
          itemName: 'Agua mineral 500 ml',
          unitId: acme.units.box,
          direction: 'in' as const,
          quantity: 0,
          baseQuantity: 0,
          unitCost: null,
          revaluationKind: 'amount' as const,
          amount: 12.0,
          sourceMovementId: PURCHASING.acme.receiptMovement,
          stockPart: null,
          soldPart: null,
        },
      ],
    },
    // AJU000004: Revaluación confirmada por FCP000002 (bodega north)
    {
      id: PAYABLES.acme.adjFcp2,
      tenantId: ACME,
      code: 'AJU000004',
      warehouseId: acme.warehouses.north,
      adjustmentDate: date('2026-09-04'),
      type: 'revaluation' as const,
      notes: 'Diferencia de precio segun factura FCP000002',
      status: 'confirmed' as const,
      createdBy: ANA,
      confirmedBy: ANA,
      confirmedAt: at('2026-09-04'),
      originType: 'purchase_invoice',
      originId: PAYABLES.acme.invoice2,
      lines: [
        {
          id: PAYABLES.acme.adjFcp2Line,
          lineNumber: 1,
          itemId: acme.items.detergent,
          itemSku: 'DETERGENTE-1KG',
          itemName: 'Detergente en polvo 1 kg',
          unitId: acme.units.kilo,
          direction: 'in' as const,
          quantity: 0,
          baseQuantity: 0,
          unitCost: 3.5,
          revaluationKind: 'amount' as const,
          amount: 5.0,
          sourceMovementId: PURCHASING.acme.northReceiptMovement,
          stockPart: 5.0,
          soldPart: 0.0,
        },
      ],
    },
    // AJU000005: Revaluación en borrador por FCP000003 (bodega main)
    {
      id: PAYABLES.acme.adjFcp3Main,
      tenantId: ACME,
      code: 'AJU000005',
      warehouseId: acme.warehouses.main,
      adjustmentDate: date('2026-09-06'),
      type: 'revaluation' as const,
      notes: 'Diferencia de precio segun factura FCP000003',
      status: 'draft' as const,
      createdBy: ANA,
      confirmedBy: null,
      confirmedAt: null,
      originType: 'purchase_invoice',
      originId: PAYABLES.acme.invoice3,
      lines: [
        {
          id: PAYABLES.acme.adjFcp3MainLine,
          lineNumber: 1,
          itemId: acme.items.water,
          itemSku: 'AGUA-500',
          itemName: 'Agua mineral 500 ml',
          unitId: acme.units.box,
          direction: 'in' as const,
          quantity: 0,
          baseQuantity: 0,
          unitCost: null,
          revaluationKind: 'amount' as const,
          amount: 4.0,
          sourceMovementId: PURCHASING.acme.interWarehouseWaterMovement,
          stockPart: null,
          soldPart: null,
        },
      ],
    },
    // AJU000006: Revaluación en borrador por FCP000003 (bodega north)
    {
      id: PAYABLES.acme.adjFcp3North,
      tenantId: ACME,
      code: 'AJU000006',
      warehouseId: acme.warehouses.north,
      adjustmentDate: date('2026-09-06'),
      type: 'revaluation' as const,
      notes: 'Diferencia de precio segun factura FCP000003',
      status: 'draft' as const,
      createdBy: ANA,
      confirmedBy: null,
      confirmedAt: null,
      originType: 'purchase_invoice',
      originId: PAYABLES.acme.invoice3,
      lines: [
        {
          id: PAYABLES.acme.adjFcp3NorthLine,
          lineNumber: 1,
          itemId: acme.items.detergent,
          itemSku: 'DETERGENTE-1KG',
          itemName: 'Detergente en polvo 1 kg',
          unitId: acme.units.kilo,
          direction: 'in' as const,
          quantity: 0,
          baseQuantity: 0,
          unitCost: null,
          revaluationKind: 'amount' as const,
          amount: 4.5,
          sourceMovementId: PURCHASING.acme.interWarehouseNorthMovement,
          stockPart: null,
          soldPart: null,
        },
      ],
    },
    // AJU000007: Revaluación negativa en borrador por NCP000001 (bodega main)
    {
      id: PAYABLES.acme.adjNcp1,
      tenantId: ACME,
      code: 'AJU000007',
      warehouseId: acme.warehouses.main,
      adjustmentDate: date('2026-09-08'),
      type: 'revaluation' as const,
      notes: 'Diferencia de precio segun nota de credito NCP000001',
      status: 'draft' as const,
      createdBy: ANA,
      confirmedBy: null,
      confirmedAt: null,
      originType: 'supplier_credit_note',
      originId: PAYABLES.acme.creditNote1,
      lines: [
        {
          id: PAYABLES.acme.adjNcp1Line,
          lineNumber: 1,
          itemId: acme.items.water,
          itemSku: 'AGUA-500',
          itemName: 'Agua mineral 500 ml',
          unitId: acme.units.box,
          direction: 'out' as const,
          quantity: 0,
          baseQuantity: 0,
          unitCost: null,
          revaluationKind: 'amount' as const,
          amount: -10.0,
          sourceMovementId: PURCHASING.acme.receiptMovement,
          stockPart: null,
          soldPart: null,
        },
      ],
    },
  ];

  // Movimientos en kardex y stock de la revaluación aprobada AJU000004 en north
  await prisma.inventoryMovement.create({
    data: {
      id: PAYABLES.acme.adjFcp2OutMovement,
      tenantId: ACME,
      itemId: acme.items.detergent,
      warehouseId: acme.warehouses.north,
      sequence: 2,
      direction: 'out',
      quantity: 10,
      unitCost: 3.0,
      balanceQuantity: 0,
      balanceAverageCost: 3.0,
      originType: 'adjustment',
      originId: PAYABLES.acme.adjFcp2,
      originLineId: PAYABLES.acme.adjFcp2Line,
      originDate: date('2026-09-04'),
      occurredAt: at('2026-09-04'),
    },
  });
  await prisma.inventoryMovement.create({
    data: {
      id: PAYABLES.acme.adjFcp2InMovement,
      tenantId: ACME,
      itemId: acme.items.detergent,
      warehouseId: acme.warehouses.north,
      sequence: 3,
      direction: 'in',
      quantity: 10,
      unitCost: 3.5,
      balanceQuantity: 10,
      balanceAverageCost: 3.5,
      originType: 'adjustment',
      originId: PAYABLES.acme.adjFcp2,
      originLineId: PAYABLES.acme.adjFcp2Line,
      originDate: date('2026-09-04'),
      occurredAt: at('2026-09-04'),
    },
  });
  await prisma.itemStock.update({
    where: {
      tenantId_itemId_warehouseId: {
        tenantId: ACME,
        itemId: acme.items.detergent,
        warehouseId: acme.warehouses.north,
      },
    },
    data: {
      quantity: 10,
      averageCost: 3.5,
      lastSequence: 3,
      updatedAt: at('2026-09-04'),
    },
  });

  // Movimientos en kardex de las entradas propias inter-bodegas citadas por FCP000003
  await prisma.inventoryMovement.create({
    data: {
      id: PURCHASING.acme.interWarehouseNorthMovement,
      tenantId: ACME,
      itemId: acme.items.detergent,
      warehouseId: acme.warehouses.north,
      sequence: 4,
      direction: 'in',
      quantity: 3,
      unitCost: 3.0,
      balanceQuantity: 13,
      balanceAverageCost: 3.38,
      originType: 'receipt',
      originId: PURCHASING.acme.interWarehouseNorthReceipt,
      originLineId: PURCHASING.acme.interWarehouseNorthReceiptLine,
      originDate: date('2026-09-04'),
      occurredAt: at('2026-09-04'),
    },
  });
  await prisma.itemStock.update({
    where: {
      tenantId_itemId_warehouseId: {
        tenantId: ACME,
        itemId: acme.items.detergent,
        warehouseId: acme.warehouses.north,
      },
    },
    data: {
      quantity: 13,
      averageCost: 3.38,
      lastSequence: 4,
      updatedAt: at('2026-09-04'),
    },
  });

  await prisma.inventoryMovement.create({
    data: {
      id: PURCHASING.acme.interWarehouseWaterMovement,
      tenantId: ACME,
      itemId: acme.items.water,
      warehouseId: acme.warehouses.main,
      sequence: 4,
      direction: 'in',
      quantity: 48,
      unitCost: 0.5,
      balanceQuantity: 336,
      balanceAverageCost: 0.5,
      originType: 'receipt',
      originId: PURCHASING.acme.interWarehouseWaterReceipt,
      originLineId: PURCHASING.acme.interWarehouseWaterReceiptLine,
      originDate: date('2026-09-05'),
      occurredAt: at('2026-09-05'),
    },
  });
  await prisma.itemStock.update({
    where: {
      tenantId_itemId_warehouseId: {
        tenantId: ACME,
        itemId: acme.items.water,
        warehouseId: acme.warehouses.main,
      },
    },
    data: {
      quantity: 336,
      averageCost: 0.5,
      lastSequence: 4,
      updatedAt: at('2026-09-05'),
    },
  });

  for (const { lines, ...adj } of revaluations) {
    await prisma.adjustment.create({
      data: {
        ...adj,
        createdAt: adj.adjustmentDate,
        updatedAt: adj.confirmedAt ?? adj.adjustmentDate,
      },
    });
    await prisma.adjustmentLine.createMany({
      data: lines.map((l) => ({
        ...l,
        tenantId: adj.tenantId,
        adjustmentId: adj.id,
      })),
    });
  }

  // Notas de crédito de proveedor
  const creditNotes = [
    // NCP000001: Rebaja de precio sobre FCP000001 con sobrante gastado después desde Pagos
    {
      id: PAYABLES.acme.creditNote1,
      tenantId: ACME,
      code: 'NCP000001',
      supplierId: PURCHASING.acme.andina,
      invoiceId: PAYABLES.acme.invoice1,
      purchaseReturnId: null,
      issuePaymentId: PAYABLES.acme.payment2,
      issueDate: date('2026-09-08'),
      reason: 'price_correction' as const,
      reasonDetail: null,
      notes: 'Corrección de precio acordada',
      status: 'confirmed' as const,
      subtotal: 10.0,
      tax: 1.6,
      total: 11.6,
      priceDifference: -10.0,
      exchangeDifference: 0,
      confirmedAt: at('2026-09-08'),
      ...dollarsAt(152.4),
      subtotalVes: 1524.0,
      taxVes: 243.84,
      totalVes: 1767.84,
      lines: [
        {
          id: PAYABLES.acme.creditNote1Line,
          lineNumber: 1,
          invoiceLineId: PAYABLES.acme.invoice1Line,
          itemId: acme.items.water,
          itemSku: 'AGUA-500',
          itemName: 'Agua mineral 500 ml',
          concept: null,
          unitId: acme.units.box,
          quantity: 2,
          unitPrice: 5.0,
          taxRate: 16,
          subtotal: 10.0,
          tax: 1.6,
          total: 11.6,
        },
      ],
    },
    // NCP000002: Acredita la devolución DVC000001 contra FCP000005
    {
      id: PAYABLES.acme.creditNote2,
      tenantId: ACME,
      code: 'NCP000002',
      supplierId: PURCHASING.acme.valle,
      invoiceId: PAYABLES.acme.invoice5,
      purchaseReturnId: PURCHASING.acme.purchaseReturn,
      issuePaymentId: PAYABLES.acme.payment3,
      issueDate: date('2026-09-06'),
      reason: 'damaged_goods' as const,
      reasonDetail: null,
      notes: 'Devolución de 4 jabones defectuosos',
      status: 'confirmed' as const,
      subtotal: 6.0,
      tax: 0.96,
      total: 6.96,
      priceDifference: 0,
      exchangeDifference: 0,
      confirmedAt: at('2026-09-06'),
      ...dollarsAt(152.4),
      subtotalVes: 914.4,
      taxVes: 146.3,
      totalVes: 1060.7,
      lines: [
        {
          id: PAYABLES.acme.creditNote2Line,
          lineNumber: 1,
          invoiceLineId: null,
          itemId: acme.items.soap,
          itemSku: 'JABON-500',
          itemName: 'Jabón líquido 500 ml',
          concept: null,
          unitId: acme.units.piece,
          quantity: 4,
          unitPrice: 1.5,
          taxRate: 16,
          subtotal: 6.0,
          tax: 0.96,
          total: 6.96,
        },
      ],
    },
    // Globex: Notas de crédito para aislamiento
    {
      id: PAYABLES.globex.confirmedCreditNote,
      tenantId: GLOBEX,
      code: 'NCP000001',
      supplierId: PURCHASING.globex.supplier,
      invoiceId: PAYABLES.globex.confirmedInvoice,
      purchaseReturnId: null,
      issuePaymentId: null,
      issueDate: date('2026-09-06'),
      reason: 'subsequent_discount' as const,
      reasonDetail: null,
      notes: 'Descuento proveedor',
      status: 'confirmed' as const,
      subtotal: 10.0,
      tax: 1.6,
      total: 11.6,
      priceDifference: 0,
      exchangeDifference: 0,
      confirmedAt: at('2026-09-06'),
      ...dollarsAt(141),
      subtotalVes: 1410,
      taxVes: 225.6,
      totalVes: 1635.6,
      lines: [
        {
          id: PAYABLES.globex.confirmedCreditNoteLine,
          lineNumber: 1,
          invoiceLineId: null,
          itemId: globex.items.filter,
          itemSku: 'FILTRO-ACEITE',
          itemName: 'Filtro de aceite',
          concept: null,
          unitId: globex.units.piece,
          quantity: 1,
          unitPrice: 10.0,
          taxRate: 16,
          subtotal: 10.0,
          tax: 1.6,
          total: 11.6,
        },
      ],
    },
    {
      id: PAYABLES.globex.draftCreditNote,
      tenantId: GLOBEX,
      code: 'NCP000002',
      supplierId: PURCHASING.globex.supplier,
      invoiceId: PAYABLES.globex.confirmedInvoice,
      purchaseReturnId: null,
      issuePaymentId: null,
      issueDate: date('2026-09-07'),
      reason: 'price_correction' as const,
      reasonDetail: null,
      notes: 'Borrador nota aislamiento',
      status: 'draft' as const,
      subtotal: 5.0,
      tax: 0.8,
      total: 5.8,
      priceDifference: 0,
      exchangeDifference: 0,
      confirmedAt: null,
      ...dollarsAt(141),
      subtotalVes: 705,
      taxVes: 112.8,
      totalVes: 817.8,
      lines: [
        {
          id: PAYABLES.globex.draftCreditNoteLine,
          lineNumber: 1,
          invoiceLineId: null,
          itemId: globex.items.filter,
          itemSku: 'FILTRO-ACEITE',
          itemName: 'Filtro de aceite',
          concept: null,
          unitId: globex.units.piece,
          quantity: 1,
          unitPrice: 5.0,
          taxRate: 16,
          subtotal: 5.0,
          tax: 0.8,
          total: 5.8,
        },
      ],
    },
  ];

  for (const { lines, ...note } of creditNotes) {
    await prisma.supplierCreditNote.create({
      data: {
        ...note,
        issuePaymentId: null,
        createdAt: note.issueDate,
        updatedAt: note.confirmedAt ?? note.issueDate,
      },
    });
    await prisma.supplierCreditNoteLine.createMany({
      data: lines.map((l) => ({
        ...l,
        tenantId: note.tenantId,
        creditNoteId: note.id,
      })),
    });
  }

  // Pagos a proveedor
  const payments = [
    // PAG000001: Abona dos facturas (FCP000001 por 65 USD y FCP000004 por 15 USD)
    {
      id: PAYABLES.acme.payment1,
      tenantId: ACME,
      code: 'PAG000001',
      supplierId: PURCHASING.acme.andina,
      paymentDate: date('2026-09-07'),
      method: 'transfer' as const,
      reference: 'TRF-PROV-771',
      notes: 'Abono a facturas de agua y flete',
      amount: 80.0,
      status: 'confirmed' as const,
      confirmedAt: at('2026-09-07'),
      ...dollarsAt(150.25),
      amountVes: 12020.0,
      creditSourceId: null,
      allocations: [
        { id: PAYABLES.acme.payment1Alloc1, invoiceId: PAYABLES.acme.invoice1, amount: 65.0, exchangeDifference: 0 },
        { id: PAYABLES.acme.payment1Alloc2, invoiceId: PAYABLES.acme.invoice4, amount: 15.0, exchangeDifference: 0 },
      ],
    },
    // PAG000002: Pago de emisión de NCP000001 (amortiza saldo vivo de FCP000001 = 4.60 USD)
    {
      id: PAYABLES.acme.payment2,
      tenantId: ACME,
      code: 'PAG000002',
      supplierId: PURCHASING.acme.andina,
      paymentDate: date('2026-09-08'),
      method: 'credit_note' as const,
      reference: null,
      notes: 'Amortización automática por NCP000001',
      amount: 4.6,
      status: 'confirmed' as const,
      confirmedAt: at('2026-09-08'),
      ...dollarsAt(152.4),
      amountVes: 701.04,
      creditSourceId: PAYABLES.acme.creditNote1,
      allocations: [
        { id: PAYABLES.acme.payment2Alloc1, invoiceId: PAYABLES.acme.invoice1, amount: 4.6, exchangeDifference: 9.89 },
      ],
    },
    // PAG000003: Pago de emisión de NCP000002 (amortiza 6.96 USD en FCP000005)
    {
      id: PAYABLES.acme.payment3,
      tenantId: ACME,
      code: 'PAG000003',
      supplierId: PURCHASING.acme.valle,
      paymentDate: date('2026-09-06'),
      method: 'credit_note' as const,
      reference: null,
      notes: 'Amortización automática por devolución NCP000002',
      amount: 6.96,
      status: 'confirmed' as const,
      confirmedAt: at('2026-09-06'),
      ...dollarsAt(152.4),
      amountVes: 1060.7,
      creditSourceId: PAYABLES.acme.creditNote2,
      allocations: [
        { id: PAYABLES.acme.payment3Alloc1, invoiceId: PAYABLES.acme.invoice5, amount: 6.96, exchangeDifference: 14.96 },
      ],
    },
    // PAG000004: Consumo de crédito remanente de NCP000001 (7.00 USD aplicados a FCP000002)
    {
      id: PAYABLES.acme.payment4,
      tenantId: ACME,
      code: 'PAG000004',
      supplierId: PURCHASING.acme.andina,
      paymentDate: date('2026-09-09'),
      method: 'credit_note' as const,
      reference: null,
      notes: 'Consumo de crédito remanente de NCP000001',
      amount: 7.0,
      status: 'confirmed' as const,
      confirmedAt: at('2026-09-09'),
      ...dollarsAt(152.4),
      amountVes: 1066.8,
      creditSourceId: PAYABLES.acme.creditNote1,
      allocations: [
        { id: PAYABLES.acme.payment4Alloc1, invoiceId: PAYABLES.acme.invoice2, amount: 7.0, exchangeDifference: 15.05 },
      ],
    },
    // Globex: Pagos para aislamiento
    {
      id: PAYABLES.globex.confirmedPayment,
      tenantId: GLOBEX,
      code: 'PAG000001',
      supplierId: PURCHASING.globex.supplier,
      paymentDate: date('2026-09-06'),
      method: 'transfer' as const,
      reference: 'TRF-GLX-01',
      notes: 'Pago confirmado',
      amount: 20.0,
      status: 'confirmed' as const,
      confirmedAt: at('2026-09-06'),
      ...dollarsAt(141),
      amountVes: 2820.0,
      creditSourceId: null,
      allocations: [
        { id: PAYABLES.globex.confirmedPaymentAlloc, invoiceId: PAYABLES.globex.confirmedInvoice, amount: 20.0, exchangeDifference: 0 },
      ],
    },
    {
      id: PAYABLES.globex.draftPayment,
      tenantId: GLOBEX,
      code: 'PAG000002',
      supplierId: PURCHASING.globex.supplier,
      paymentDate: date('2026-09-07'),
      method: 'cash' as const,
      reference: null,
      notes: 'Pago borrador',
      amount: 10.0,
      status: 'draft' as const,
      confirmedAt: null,
      ...dollarsAt(141),
      amountVes: 1410.0,
      creditSourceId: null,
      allocations: [
        { id: PAYABLES.globex.draftPaymentAlloc, invoiceId: PAYABLES.globex.confirmedInvoice, amount: 10.0, exchangeDifference: 0 },
      ],
    },
  ];

  for (const { allocations, ...payment } of payments) {
    await prisma.supplierPayment.create({
      data: {
        ...payment,
        createdAt: payment.paymentDate,
        updatedAt: payment.confirmedAt ?? payment.paymentDate,
      },
    });
    for (const alloc of allocations) {
      await prisma.supplierPaymentAllocation.create({
        data: {
          id: alloc.id,
          tenantId: payment.tenantId,
          paymentId: payment.id,
          invoiceId: alloc.invoiceId,
          amount: alloc.amount,
          exchangeRate: payment.exchangeRate,
          exchangeDifference: alloc.exchangeDifference,
        },
      });
    }
  }

  // Enlazar issuePaymentId en notas de crédito
  for (const note of creditNotes) {
    if (note.issuePaymentId) {
      await prisma.supplierCreditNote.update({
        where: { tenantId_id: { tenantId: note.tenantId, id: note.id } },
        data: { issuePaymentId: note.issuePaymentId },
      });
    }
  }

  // Secuencias de correlativos para Cuentas por Pagar e Inventario
  for (const [tenantId, prefix, lastValue] of [
    [ACME, 'FCP', 5],
    [ACME, 'PAG', 4],
    [ACME, 'NCP', 2],
    [ACME, 'AJU', 7],
    [GLOBEX, 'FCP', 2],
    [GLOBEX, 'PAG', 2],
    [GLOBEX, 'NCP', 2],
    [GLOBEX, 'AJU', 2],
  ] as const) {
    await prisma.$executeRaw`
      INSERT INTO code_sequences (tenant_id, prefix, last_value)
      VALUES (${tenantId}::uuid, ${prefix}, ${lastValue})
      ON CONFLICT (tenant_id, prefix)
      DO UPDATE SET last_value = GREATEST(code_sequences.last_value, EXCLUDED.last_value)`;
  }
}

// La empresa de las guardas de rendimiento: 50 clientes, 5.000 facturas con su pedido y su despacho,
// y 3.000 cobros confirmados. Se genera en SQL con identificadores derivados del numero de fila: en
// segundos, y siempre igual.
async function seedVolume(prisma: PrismaClient): Promise<void> {
  const warehouse = 'e3000000-0000-4000-8000-000000000401';

  await prisma.warehouse.create({ data: { id: warehouse, tenantId: VOLUME, code: 'BOD000001', name: 'Central', isDefault: true } });

  await prisma.$executeRaw`
    INSERT INTO customers (id, tenant_id, code, name, payment_term_days, updated_at)
    SELECT md5('vol-customer-' || n)::uuid, ${VOLUME}::uuid, 'CLI' || lpad(n::text, 6, '0'), 'Cliente volumen ' || lpad(n::text, 2, '0'), 30, now()
    FROM generate_series(1, 50) AS n`;

  await prisma.$executeRaw`
    INSERT INTO sales_orders (id, tenant_id, code, customer_id, warehouse_id, order_date, status, confirmed_at, updated_at, currency, exchange_rate, base_currency, base_exchange_rate, manual_exchange_rate)
    SELECT md5('vol-order-' || n)::uuid, ${VOLUME}::uuid, 'PED' || lpad(n::text, 6, '0'), md5('vol-customer-' || (n % 50 + 1))::uuid, ${warehouse}::uuid,
           date '2026-01-01' + (n % 250), 'dispatched'::sales_order_status, now(), now(), 'USD', 140, 'USD', 140, false
    FROM generate_series(1, 5000) AS n`;

  await prisma.$executeRaw`
    INSERT INTO dispatches (id, tenant_id, code, order_id, warehouse_id, dispatch_date, status, confirmed_at, updated_at)
    SELECT md5('vol-dispatch-' || n)::uuid, ${VOLUME}::uuid, 'DES' || lpad(n::text, 6, '0'), md5('vol-order-' || n)::uuid, ${warehouse}::uuid,
           date '2026-01-01' + (n % 250), 'confirmed'::dispatch_status, now(), now()
    FROM generate_series(1, 5000) AS n`;

  await prisma.$executeRaw`
    INSERT INTO invoices (id, tenant_id, code, dispatch_id, order_id, customer_id, issue_date, due_date, status, subtotal, tax, total, updated_at, currency, exchange_rate, base_currency, base_exchange_rate, manual_exchange_rate, subtotal_ves, tax_ves, total_ves)
    SELECT md5('vol-invoice-' || n)::uuid, ${VOLUME}::uuid, 'FAC' || lpad(n::text, 6, '0'), md5('vol-dispatch-' || n)::uuid, md5('vol-order-' || n)::uuid,
           md5('vol-customer-' || (n % 50 + 1))::uuid, date '2026-01-01' + (n % 250), date '2026-01-31' + (n % 250), 'issued'::invoice_status,
           10 + n % 90, 0, 10 + n % 90, now(), 'USD', 140, 'USD', 140, false, (10 + n % 90) * 140, 0, (10 + n % 90) * 140
    FROM generate_series(1, 5000) AS n`;

  await prisma.$executeRaw`
    INSERT INTO customer_payments (id, tenant_id, code, customer_id, payment_date, method, amount, status, confirmed_at, updated_at, currency, exchange_rate, base_currency, base_exchange_rate, manual_exchange_rate, amount_ves)
    SELECT md5('vol-payment-' || n)::uuid, ${VOLUME}::uuid, 'COB' || lpad(n::text, 6, '0'), md5('vol-customer-' || (n % 50 + 1))::uuid,
           date '2026-01-01' + (n % 250), 'transfer'::payment_method, 5, 'confirmed'::payment_status, now(), now(), 'USD', 140, 'USD', 140, false, 700
    FROM generate_series(1, 3000) AS n`;

  await prisma.$executeRaw`
    INSERT INTO payment_allocations (id, tenant_id, payment_id, invoice_id, amount, exchange_rate, exchange_difference)
    SELECT md5('vol-allocation-' || n)::uuid, ${VOLUME}::uuid, md5('vol-payment-' || n)::uuid, md5('vol-invoice-' || n)::uuid, 5, 140, 0
    FROM generate_series(1, 3000) AS n`;

  for (const [prefix, lastValue] of [['CLI', 50], ['PED', 5000], ['DES', 5000], ['FAC', 5000], ['COB', 3000], ['BOD', 1]] as const) {
    await prisma.$executeRaw`
      INSERT INTO code_sequences (tenant_id, prefix, last_value)
      VALUES (${VOLUME}::uuid, ${prefix}, ${lastValue})
      ON CONFLICT (tenant_id, prefix)
      DO UPDATE SET last_value = GREATEST(code_sequences.last_value, EXCLUDED.last_value)`;
  }
}

async function verifySeedIntegrity(prisma: PrismaClient): Promise<void> {
  // 1. Verificar cupos de líneas de entrada de mercancía (facturado <= recibido - devuelto)
  const receiptLines = await prisma.goodsReceiptLine.findMany({
    include: {
      receipt: true,
      invoiceLines: {
        where: {
          invoice: { status: 'confirmed' },
        },
      },
      returnLines: {
        where: {
          purchaseReturn: { status: 'confirmed' },
        },
      },
    },
  });

  for (const rl of receiptLines) {
    const received = Number(rl.quantity);
    const returned = rl.returnLines.reduce((acc, ret) => acc + Number(ret.quantity), 0);
    const invoiced = rl.invoiceLines.reduce((acc, inv) => acc + Number(inv.quantity), 0);

    // Buscar notas de crédito confirmadas que acreditan devoluciones de estas facturas
    const invoiceIds = rl.invoiceLines.map((il) => il.invoiceId);
    const creditedReturns = await prisma.supplierCreditNoteLine.findMany({
      where: {
        creditNote: {
          tenantId: rl.tenantId,
          invoiceId: { in: invoiceIds },
          purchaseReturnId: { not: null },
          status: 'confirmed',
        },
      },
      select: { quantity: true },
    });
    const credited = creditedReturns.reduce((acc, cn) => acc + Number(cn.quantity), 0);

    // 1. Lo facturado bruto nunca puede superar lo recibido físicamente
    if (invoiced > received) {
      throw new Error(
        `Seed integrity violation: receipt line ${rl.id} (${rl.itemSku ?? rl.id}) has received=${received}, but confirmed invoices total=${invoiced}`,
      );
    }

    // 2. Lo facturado neto no puede superar lo recibido neto tras devoluciones
    const netInvoiced = invoiced - credited;
    const netReceived = received - returned;
    if (netInvoiced > netReceived) {
      throw new Error(
        `Seed integrity violation: receipt line ${rl.id} (${rl.itemSku ?? rl.id}) has netReceived=${netReceived} (received=${received} - returned=${returned}), but netInvoiced=${netInvoiced} (invoiced=${invoiced} - credited=${credited})`,
      );
    }
  }

  // 2. Verificar priceDifference de facturas de compra confirmadas contra calculatePurchasePriceDifference
  const confirmedInvoices = await prisma.purchaseInvoice.findMany({
    where: { status: 'confirmed' },
    include: {
      lines: {
        include: {
          receiptLine: {
            include: { receipt: true },
          },
        },
      },
    },
  });

  for (const inv of confirmedInvoices) {
    const linesWithReceipt = inv.lines.filter((l) => l.receiptLineId && l.receiptLine);
    if (linesWithReceipt.length === 0) continue;

    const companySettings = await prisma.companySettings.findUnique({
      where: { tenantId: inv.tenantId },
    });
    const baseCurrency = companySettings?.baseCurrency ?? 'USD';

    const invRate = effectiveRateToBase(
      inv.currency,
      baseCurrency,
      inv.exchangeRate ? Number(inv.exchangeRate) : null,
      inv.baseExchangeRate ? Number(inv.baseExchangeRate) : null,
    );

    const priceDiffInputs: PriceDifferenceLineInput[] = linesWithReceipt.map((l) => {
      const receipt = l.receiptLine!.receipt;
      const recRate = effectiveRateToBase(
        receipt.currency,
        baseCurrency,
        receipt.exchangeRate ? Number(receipt.exchangeRate) : null,
        receipt.baseExchangeRate ? Number(receipt.baseExchangeRate) : null,
      );

      return {
        quantity: Number(l.quantity),
        invoiceUnitPrice: Number(l.unitPrice),
        invoiceRate: invRate,
        receiptUnitCost: Number(l.receiptLine!.unitCost),
        receiptRate: recRate,
      };
    });

    const expected = calculatePurchasePriceDifference(priceDiffInputs);
    const actualPriceDiff = Number(inv.priceDifference);

    if (Math.abs(actualPriceDiff - expected.priceDifference) > 0.001) {
      throw new Error(
        `Seed integrity violation: invoice ${inv.code} (${inv.id}) has stored priceDifference=${actualPriceDiff}, but calculatePurchasePriceDifference gives ${expected.priceDifference}`,
      );
    }
  }

  // 3. Verificar invoicedQuantity de cada línea de orden contra facturas confirmadas
  const orderLines = await prisma.purchaseOrderLine.findMany({
    include: {
      order: true,
      invoiceLines: {
        where: {
          invoice: { status: 'confirmed' },
        },
      },
    },
  });

  for (const ol of orderLines) {
    const invoicedSum = ol.invoiceLines.reduce((acc, il) => acc + Number(il.quantity), 0);
    const storedInvoiced = Number(ol.invoicedQuantity);
    if (Math.abs(storedInvoiced - invoicedSum) > 0.0001) {
      throw new Error(
        `Seed integrity violation: order line ${ol.id} (order ${ol.order.code}, item ${ol.itemSku}) has stored invoicedQuantity=${storedInvoiced}, but confirmed invoices total=${invoicedSum}`,
      );
    }
  }

  // 4. Verificar que la suma de revaluaciones por importe de cada factura coincide con su priceDifference (una por bodega)
  for (const inv of confirmedInvoices) {
    const invPriceDiff = Number(inv.priceDifference);
    const revalAdjustments = await prisma.adjustment.findMany({
      where: {
        tenantId: inv.tenantId,
        originType: 'purchase_invoice',
        originId: inv.id,
        type: 'revaluation',
      },
      include: {
        lines: true,
      },
    });

    if (Math.abs(invPriceDiff) > 0.001) {
      const warehouseIds = revalAdjustments.map((a) => a.warehouseId);
      const uniqueWarehouses = new Set(warehouseIds);
      if (uniqueWarehouses.size !== warehouseIds.length) {
        throw new Error(
          `Seed integrity violation: invoice ${inv.code} has multiple revaluation adjustments for the same warehouse`,
        );
      }

      const revalTotal = revalAdjustments
        .flatMap((a) => a.lines)
        .filter((l) => l.revaluationKind === 'amount')
        .reduce((sum, l) => sum + Number(l.amount), 0);

      if (Math.abs(revalTotal - invPriceDiff) > 0.001) {
        throw new Error(
          `Seed integrity violation: invoice ${inv.code} priceDifference=${invPriceDiff}, but revaluation adjustments sum=${revalTotal}`,
        );
      }
    } else {
      if (revalAdjustments.length > 0) {
        throw new Error(
          `Seed integrity violation: invoice ${inv.code} has priceDifference=0, but has ${revalAdjustments.length} revaluation adjustments`,
        );
      }
    }
  }

  // 5. Verificar que la suma de revaluaciones por importe de cada nota de crédito coincide con su priceDifference (una por bodega)
  const confirmedCreditNotes = await prisma.supplierCreditNote.findMany({
    where: { status: 'confirmed' },
  });

  for (const note of confirmedCreditNotes) {
    const notePriceDiff = Number(note.priceDifference);
    const revalAdjustments = await prisma.adjustment.findMany({
      where: {
        tenantId: note.tenantId,
        originType: 'supplier_credit_note',
        originId: note.id,
        type: 'revaluation',
      },
      include: {
        lines: true,
      },
    });

    if (Math.abs(notePriceDiff) > 0.001) {
      const warehouseIds = revalAdjustments.map((a) => a.warehouseId);
      const uniqueWarehouses = new Set(warehouseIds);
      if (uniqueWarehouses.size !== warehouseIds.length) {
        throw new Error(
          `Seed integrity violation: credit note ${note.code} has multiple revaluation adjustments for the same warehouse`,
        );
      }

      const revalTotal = revalAdjustments
        .flatMap((a) => a.lines)
        .filter((l) => l.revaluationKind === 'amount')
        .reduce((sum, l) => sum + Number(l.amount), 0);

      if (Math.abs(revalTotal - notePriceDiff) > 0.001) {
        throw new Error(
          `Seed integrity violation: credit note ${note.code} priceDifference=${notePriceDiff}, but revaluation adjustments sum=${revalTotal}`,
        );
      }
    } else {
      if (revalAdjustments.length > 0) {
        throw new Error(
          `Seed integrity violation: credit note ${note.code} has priceDifference=0, but has ${revalAdjustments.length} revaluation adjustments`,
        );
      }
    }
  }

  // 6. Toda línea facturada de un artículo que mueve existencias debe citar una línea de entrada
  const invoiceLinesOfStockItems = await prisma.purchaseInvoiceLine.findMany({
    where: {
      item: {
        type: 'inventoried',
      },
    },
    include: {
      invoice: true,
      item: true,
    },
  });

  for (const line of invoiceLinesOfStockItems) {
    if (!line.receiptLineId) {
      throw new Error(
        `Seed integrity violation: invoice ${line.invoice.code} line ${line.id} for inventoried item ${line.itemSku ?? line.itemId} does not cite a receipt line`,
      );
    }
  }

  // 7. En cada línea de orden que mueve existencias, lo facturado no pasa de lo recibido
  const stockOrderLines = await prisma.purchaseOrderLine.findMany({
    where: {
      movesStock: true,
    },
    include: {
      order: true,
    },
  });

  for (const ol of stockOrderLines) {
    const invoiced = Number(ol.invoicedQuantity);
    const received = Number(ol.receivedQuantity);
    if (invoiced > received) {
      throw new Error(
        `Seed integrity violation: order line ${ol.id} (order ${ol.order.code}, item ${ol.itemSku}) has invoicedQuantity=${invoiced} which exceeds receivedQuantity=${received}`,
      );
    }
  }
}

await main();
