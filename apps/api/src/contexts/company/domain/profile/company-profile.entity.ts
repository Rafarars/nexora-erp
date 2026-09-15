import { InvalidCompanyEmailError } from '../errors/company.errors.js';
import { optionalText, requiredText } from '../shared/text.js';
import { TenantId } from '../shared/tenant-id.vo.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CompanyProfilePrimitives {
  tenantId: string;
  legalName: string;
  tradeName: string | null;
  fiscalId: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  updatedAt: Date | null;
}

export interface CompanyProfileInput {
  legalName: string;
  tradeName?: string | null;
  fiscalId?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

type Details = Omit<CompanyProfilePrimitives, 'tenantId' | 'updatedAt'>;

// Quien es la empresa en los documentos que emite: razon social, RIF, direccion y contacto.
export class CompanyProfile {
  private constructor(
    readonly tenantId: TenantId,
    private details: Details,
    private updatedAt: Date | null,
  ) {}

  // La empresa que nunca lleno sus datos se presenta con el nombre con que se registro.
  static blank(tenantId: TenantId, registeredName: string): CompanyProfile {
    return new CompanyProfile(tenantId, validated({ legalName: registeredName }), null);
  }

  static fromPrimitives(row: CompanyProfilePrimitives): CompanyProfile {
    const { tenantId, updatedAt, ...details } = row;

    return new CompanyProfile(TenantId.of(tenantId), details, updatedAt);
  }

  toPrimitives(): CompanyProfilePrimitives {
    return { tenantId: this.tenantId.value, ...this.details, updatedAt: this.updatedAt };
  }

  update(input: CompanyProfileInput, now: Date): void {
    this.details = validated(input);
    this.updatedAt = now;
  }
}

function validated(input: CompanyProfileInput): Details {
  const email = optionalText(input.email, 150, 'CompanyEmail');

  if (email && !EMAIL_PATTERN.test(email)) throw new InvalidCompanyEmailError(email);

  return {
    legalName: requiredText(input.legalName, 150, 'CompanyLegalName'),
    tradeName: optionalText(input.tradeName, 150, 'CompanyTradeName'),
    // El RIF se escribe en mayusculas: j-40000001-2 y J-40000001-2 son el mismo.
    fiscalId: optionalText(input.fiscalId, 30, 'CompanyFiscalId')?.toUpperCase() ?? null,
    address: optionalText(input.address, 300, 'CompanyAddress'),
    phone: optionalText(input.phone, 40, 'CompanyPhone'),
    email,
  };
}
