import { Uuid } from '../../../../shared/domain/uuid.vo.js';
import { InvalidPaymentTermError, InvalidSupplierEmailError } from '../errors/purchasing.errors.js';
import { optionalText, requiredText } from '../shared/text.js';
import { TenantId } from '../shared/tenant-id.vo.js';

export class SupplierId extends Uuid {
  static of(value: string): SupplierId {
    return new SupplierId(value);
  }
}

export interface SupplierDetails {
  name: string;
  fiscalId?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  paymentTermDays?: number | null;
}

export interface SupplierPrimitives {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  fiscalId: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  paymentTermDays: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type Contact = Omit<SupplierPrimitives, 'id' | 'tenantId' | 'code' | 'isActive' | 'createdAt' | 'updatedAt'>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A quien se le compra. Como los maestros del catalogo, nunca se borra: se desactiva, y
// uno inactivo no recibe ordenes nuevas.
export class Supplier {
  private constructor(
    readonly id: SupplierId,
    readonly tenantId: TenantId,
    readonly code: string,
    private contact: Contact,
    private active: boolean,
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {}

  static create(id: SupplierId, tenantId: TenantId, code: string, details: SupplierDetails, now: Date): Supplier {
    return new Supplier(id, tenantId, code, validated(details), true, now, now);
  }

  static fromPrimitives(row: SupplierPrimitives): Supplier {
    const { id, tenantId, code, isActive, createdAt, updatedAt, ...contact } = row;

    return new Supplier(SupplierId.of(id), TenantId.of(tenantId), code, contact, isActive, createdAt, updatedAt);
  }

  toPrimitives(): SupplierPrimitives {
    return {
      id: this.id.value,
      tenantId: this.tenantId.value,
      code: this.code,
      ...this.contact,
      isActive: this.active,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  name(): string {
    return this.contact.name;
  }

  isActive(): boolean {
    return this.active;
  }

  update(details: SupplierDetails, now: Date): void {
    this.contact = validated(details);
    this.updatedAt = now;
  }

  deactivate(now: Date): void {
    this.active = false;
    this.updatedAt = now;
  }

  activate(now: Date): void {
    this.active = true;
    this.updatedAt = now;
  }
}

function validated(details: SupplierDetails): Contact {
  const email = optionalText(details.email, 150, 'SupplierEmail');
  const paymentTermDays = details.paymentTermDays ?? 0;

  if (email && !EMAIL.test(email)) throw new InvalidSupplierEmailError(email);

  if (!Number.isInteger(paymentTermDays) || paymentTermDays < 0 || paymentTermDays > 365) {
    throw new InvalidPaymentTermError(paymentTermDays);
  }

  return {
    name: requiredText(details.name, 150, 'SupplierName'),
    // Texto libre: validar el RIF u otra identificacion fiscal queda para mas adelante.
    fiscalId: optionalText(details.fiscalId, 30, 'SupplierFiscalId'),
    email,
    phone: optionalText(details.phone, 40, 'SupplierPhone'),
    address: optionalText(details.address, 500, 'SupplierAddress'),
    paymentTermDays,
  };
}
