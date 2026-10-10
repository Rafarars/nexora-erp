import {
  InvalidAccountNameError,
  InvalidAccountTypeError,
} from '../errors/accounting.errors.js';
import { TenantId } from '../shared/tenant-id.vo.js';
import { AccountCode } from './account-code.vo.js';
import { AccountId } from './account-id.vo.js';
import { AccountType, isAccountType } from './account-type.vo.js';

export interface AccountPrimitives {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  type: AccountType;
  acceptsEntries: boolean;
  parentId: string | null;
  isActive: boolean;
}

export class Account {
  private constructor(
    private readonly _id: AccountId,
    private readonly _tenantId: TenantId,
    private _code: AccountCode,
    private _name: string,
    private readonly _type: AccountType,
    private _acceptsEntries: boolean,
    private _parentId: AccountId | null,
    private _isActive: boolean,
  ) {}

  static create(
    id: AccountId,
    tenantId: TenantId,
    props: {
      code: AccountCode;
      name: string;
      type: AccountType;
      acceptsEntries: boolean;
      parentId?: AccountId | null;
    },
  ): Account {
    const trimmedName = props.name?.trim();
    if (!trimmedName || trimmedName.length > 120) {
      throw new InvalidAccountNameError(props.name);
    }

    if (!isAccountType(props.type)) {
      throw new InvalidAccountTypeError(props.type);
    }

    return new Account(
      id,
      tenantId,
      props.code,
      trimmedName,
      props.type,
      props.acceptsEntries,
      props.parentId ?? null,
      true,
    );
  }

  static rehydrate(primitives: AccountPrimitives): Account {
    return new Account(
      AccountId.of(primitives.id),
      TenantId.of(primitives.tenantId),
      AccountCode.of(primitives.code),
      primitives.name,
      primitives.type,
      primitives.acceptsEntries,
      primitives.parentId ? AccountId.of(primitives.parentId) : null,
      primitives.isActive,
    );
  }

  update(props: { name?: string; isActive?: boolean; acceptsEntries?: boolean }): void {
    if (props.name !== undefined) {
      const trimmedName = props.name.trim();
      if (!trimmedName || trimmedName.length > 120) {
        throw new InvalidAccountNameError(props.name);
      }
      this._name = trimmedName;
    }

    if (props.isActive !== undefined) {
      this._isActive = props.isActive;
    }

    if (props.acceptsEntries !== undefined) {
      this._acceptsEntries = props.acceptsEntries;
    }
  }

  id(): AccountId {
    return this._id;
  }

  tenantId(): TenantId {
    return this._tenantId;
  }

  code(): AccountCode {
    return this._code;
  }

  name(): string {
    return this._name;
  }

  type(): AccountType {
    return this._type;
  }

  acceptsEntries(): boolean {
    return this._acceptsEntries;
  }

  parentId(): AccountId | null {
    return this._parentId;
  }

  isActive(): boolean {
    return this._isActive;
  }

  canAcceptEntries(): boolean {
    return this._isActive && this._acceptsEntries;
  }

  toPrimitives(): AccountPrimitives {
    return {
      id: this._id.value,
      tenantId: this._tenantId.value,
      code: this._code.raw,
      name: this._name,
      type: this._type,
      acceptsEntries: this._acceptsEntries,
      parentId: this._parentId?.value ?? null,
      isActive: this._isActive,
    };
  }
}
