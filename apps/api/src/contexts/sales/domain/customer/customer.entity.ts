import { Uuid } from '../../../../shared/domain/uuid.vo.js';
import { InvalidPaymentTermError, InvalidCustomerEmailError } from '../errors/sales.errors.js';
import { optionalText, requiredText } from '../shared/text.js';
import { TenantId } from '../shared/tenant-id.vo.js';

export class CustomerId extends Uuid {
  static of(value: string): CustomerId {
    return new CustomerId(value);
  }
}

export interface CustomerDetails {
  name: string;
  fiscalId?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  paymentTermDays?: number | null;
}

export interface CustomerPrimitives {
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

type Contact = Omit<CustomerPrimitives, 'id' | 'tenantId' | 'code' | 'isActive' | 'createdAt' | 'updatedAt'>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A quien se le vende. Como los maestros del catalogo, nunca se borra: se desactiva, y
// uno inactivo no recibe pedidos nuevos.
export class Customer {
  private constructor(
    readonly id: CustomerId,
    readonly tenantId: TenantId,
    readonly code: string,
    private contact: Contact,
    private active: boolean,
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {}

  static create(id: CustomerId, tenantId: TenantId, code: string, details: CustomerDetails, now: Date): Customer {
    return new Customer(id, tenantId, code, validated(details), true, now, now);
  }

  static fromPrimitives(row: CustomerPrimitives): Customer {
    const { id, tenantId, code, isActive, createdAt, updatedAt, ...contact } = row;

    return new Customer(CustomerId.of(id), TenantId.of(tenantId), code, contact, isActive, createdAt, updatedAt);
  }

  toPrimitives(): CustomerPrimitives {
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

  update(details: CustomerDetails, now: Date): void {
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

function validated(details: CustomerDetails): Contact {
  const email = optionalText(details.email, 150, 'CustomerEmail');
  const paymentTermDays = details.paymentTermDays ?? 0;

  if (email && !EMAIL.test(email)) throw new InvalidCustomerEmailError(email);

  if (!Number.isInteger(paymentTermDays) || paymentTermDays < 0 || paymentTermDays > 365) {
    throw new InvalidPaymentTermError(paymentTermDays);
  }

  return {
    name: requiredText(details.name, 150, 'CustomerName'),
    // Texto libre: validar el RIF u otra identificacion fiscal queda para mas adelante.
    fiscalId: optionalText(details.fiscalId, 30, 'CustomerFiscalId'),
    email,
    phone: optionalText(details.phone, 40, 'CustomerPhone'),
    address: optionalText(details.address, 500, 'CustomerAddress'),
    paymentTermDays,
  };
}
