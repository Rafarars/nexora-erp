import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  InvalidArgumentError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
} from '../../../../shared/domain/domain.error.js';
import { TooManyLoginAttemptsError } from './too-many-login-attempts.error.js';
import { NoActiveMembershipError } from './no-active-membership.error.js';
import { WrongCurrentPasswordError } from './wrong-current-password.error.js';
import { CannotDeactivateSelfError } from './cannot-deactivate-self.error.js';
import { ContradictoryDeclarationError } from './contradictory-declaration.error.js';
import { UndeclaredEndpointError } from './undeclared-endpoint.error.js';
import { UnknownPermissionError } from './unknown-permission.error.js';
import { CannotDropOwnAdminRoleError } from './cannot-drop-own-admin-role.error.js';
import { CannotEditAdminRoleError } from './cannot-edit-admin-role.error.js';
import { CannotGrantSelfMoreAccessError } from './cannot-grant-self-more-access.error.js';
import { LastAdministratorError } from './last-administrator.error.js';
import { RoleWithoutPermissionsError } from './role-without-permissions.error.js';
import { DuplicateMembershipError } from './duplicate-membership.error.js';
import { DuplicateRoleNameError } from './duplicate-role-name.error.js';
import { EmailAlreadyInUseError } from './email-already-in-use.error.js';
import { InactiveMembershipError } from './inactive-membership.error.js';
import { InactiveTenantError } from './inactive-tenant.error.js';
import { InactiveUserError } from './inactive-user.error.js';
import { InvalidCredentialsError } from './invalid-credentials.error.js';
import { MembershipNotFoundError } from './membership-not-found.error.js';
import { PermissionDeniedError } from './permission-denied.error.js';
import { RoleNotFoundError } from './role-not-found.error.js';
import { TenantNotFoundError } from './tenant-not-found.error.js';
import { UserNotFoundError } from './user-not-found.error.js';

// Un error que no herede de su categoria sale como 500 en vez de 404 o 409: el
// filtro global traduce por categoria, y esta prueba es lo unico que lo garantiza.
const cases: Array<[DomainError, typeof DomainError]> = [
  [new TenantNotFoundError('t'), NotFoundError],
  [new UserNotFoundError('u'), NotFoundError],
  [new MembershipNotFoundError('u', 't'), NotFoundError],
  [new RoleNotFoundError('r'), NotFoundError],
  [new EmailAlreadyInUseError('ana@acme.com'), ConflictError],
  [new DuplicateMembershipError('u', 't'), ConflictError],
  [new DuplicateRoleNameError('Sales', 't'), ConflictError],
  [new CannotDeactivateSelfError(), ConflictError],
  [new CannotDropOwnAdminRoleError(), ConflictError],
  [new LastAdministratorError(), ConflictError],
  [new CannotEditAdminRoleError(), ConflictError],
  [new CannotGrantSelfMoreAccessError(), ConflictError],
  [new RoleWithoutPermissionsError(), InvalidArgumentError],
  [new InvalidCredentialsError(), UnauthorizedError],
  [new InactiveUserError('u'), UnauthorizedError],
  [new InactiveTenantError('t'), UnauthorizedError],
  [new InactiveMembershipError('u', 't'), UnauthorizedError],
  [new PermissionDeniedError('sales.invoices.create'), ForbiddenError],
  [new UndeclaredEndpointError('SomeController'), ForbiddenError],
  [new ContradictoryDeclarationError('SomeController'), ForbiddenError],
  [new UnknownPermissionError('sales.nope'), InvalidArgumentError],
  [new TooManyLoginAttemptsError(), TooManyRequestsError],
  [new NoActiveMembershipError('u'), UnauthorizedError],
  [new WrongCurrentPasswordError(), InvalidArgumentError],
];

describe('access domain errors', () => {
  it.each(cases)('%s belongs to its category', (error, category) => {
    expect(error).toBeInstanceOf(category);
    expect(error).toBeInstanceOf(DomainError);
  });

  // Lo unico que sale por HTTP. Una plantilla con <...> en el mensaje publico
  // devolveria identificadores internos o lo que mando quien llama.
  it.each(cases)('%s gives the caller a message with nothing internal', (error) => {
    expect(error.publicMessage.length).toBeGreaterThan(0);
    expect(error.publicMessage).not.toMatch(/[<>]/);
    expect(error.publicMessage).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });

  // Dos errores nacieron sin entrar aqui y nadie se entero: el filtro los habria sacado
  // como 500. La lista se compara con el directorio para que anadir un error obligue a
  // decidir su categoria.
  it('covers every error in the folder', () => {
    const declared = new Set(cases.map(([error]) => error.name));
    const onDisk = readdirSync(new URL('.', import.meta.url))
      .filter((file) => file.endsWith('.error.ts'))
      .map((file) => file.replace(/\.error\.ts$/, ''))
      .map((slug) => slug.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join('') + 'Error');

    expect([...onDisk].filter((name) => !declared.has(name))).toEqual([]);
  });

  it('names itself with its concrete class, for readable logs', () => {
    expect(new TenantNotFoundError('t').name).toBe('TenantNotFoundError');
  });

  it('does not reveal whether the email or the password failed', () => {
    expect(new InvalidCredentialsError().message).toBe('Invalid credentials.');
  });
});
