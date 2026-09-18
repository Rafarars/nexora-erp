import { ConcurrentDefaultPriceListError, DuplicatePriceListNameError } from '../../domain/errors/price-list.errors.js';
import { PriceListId } from '../../domain/price-list/price-list-id.vo.js';
import { PriceListName } from '../../domain/price-list/price-list-name.vo.js';
import { PriceList, PriceListPrimitives } from '../../domain/price-list/price-list.entity.js';
import { PriceListRepository } from '../../domain/price-list/price-list.repository.js';
import { TenantId } from '../../domain/shared/tenant-id.vo.js';
import { ensureUniqueCode } from './unique-code.js';

// Las mismas que siembra la migracion del catalogo global: la base tiene una clave ajena y el
// doble tiene que rechazar lo mismo que ella.
const KNOWN_CURRENCIES = ['USD', 'EUR', 'VES'];

export class InMemoryPriceListRepository implements PriceListRepository {
  private rows = new Map<string, PriceListPrimitives>();

  constructor(seed: PriceList[] = []) {
    seed.forEach((priceList) => this.rows.set(priceList.id.value, priceList.toPrimitives()));
  }

  async save(priceList: PriceList): Promise<void> {
    await this.saveAll([priceList]);
  }

  // Todo o nada, como la transaccion de la base: se valida sobre una copia y solo se publica si
  // ninguna fila choca.
  async saveAll(priceLists: PriceList[]): Promise<void> {
    const next = new Map(this.rows);

    for (const priceList of priceLists) {
      next.set(priceList.id.value, priceList.toPrimitives());
    }

    for (const priceList of priceLists) {
      const row = priceList.toPrimitives();

      if (!KNOWN_CURRENCIES.includes(row.currency)) {
        throw new Error(`Currency <${row.currency}> does not exist.`);
      }

      ensureUniqueCode([...next.values()], row);
      const clash = [...next.values()].find(
        (other) => other.id !== row.id && other.tenantId === row.tenantId && other.name === row.name,
      );

      if (clash) throw new DuplicatePriceListNameError(row.name, row.tenantId);

      // El indice parcial de la base: una sola lista por defecto por empresa.
      const defaults = [...next.values()].filter((other) => other.tenantId === row.tenantId && other.isDefault);

      if (defaults.length > 1) throw new ConcurrentDefaultPriceListError(row.tenantId);
    }

    this.rows = next;
  }

  async find(tenantId: TenantId, id: PriceListId): Promise<PriceList | null> {
    const row = this.rows.get(id.value);

    return row && row.tenantId === tenantId.value ? PriceList.fromPrimitives(row) : null;
  }

  async findByName(tenantId: TenantId, name: PriceListName): Promise<PriceList | null> {
    const row = this.ofTenant(tenantId).find((candidate) => candidate.name === name.value);

    return row ? PriceList.fromPrimitives(row) : null;
  }

  async findDefault(tenantId: TenantId): Promise<PriceList | null> {
    const row = this.ofTenant(tenantId).find((candidate) => candidate.isDefault);

    return row ? PriceList.fromPrimitives(row) : null;
  }

  async searchByTenant(tenantId: TenantId): Promise<PriceList[]> {
    return this.ofTenant(tenantId).map((row) => PriceList.fromPrimitives(row));
  }

  private ofTenant(tenantId: TenantId): PriceListPrimitives[] {
    return [...this.rows.values()]
      .filter((row) => row.tenantId === tenantId.value)
      .sort((left, right) => left.name.localeCompare(right.name));
  }
}
