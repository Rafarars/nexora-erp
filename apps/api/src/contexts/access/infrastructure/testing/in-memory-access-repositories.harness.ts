import {
  AccessRepositories,
  AccessRepositoriesHarness,
} from '../../testing/access-repositories.harness.js';
import { InMemoryMembershipRepository } from './in-memory-membership.repository.js';
import { InMemoryRoleRepository } from './in-memory-role.repository.js';
import { InMemoryTenantRepository } from './in-memory-tenant.repository.js';
import { InMemoryTenantAdministration } from './in-memory-tenant-administration.js';
import { InMemoryUserRepository } from './in-memory-user.repository.js';

// Vaciar es tirar los Map y empezar de cero.
export class InMemoryAccessRepositoriesHarness implements AccessRepositoriesHarness {
  private current = this.build();

  repositories(): AccessRepositories {
    return this.current;
  }

  async reset(): Promise<void> {
    this.current = this.build();
  }

  async close(): Promise<void> {}

  private build(): AccessRepositories {
    const users = new InMemoryUserRepository();
    const memberships = new InMemoryMembershipRepository();
    const roles = new InMemoryRoleRepository();

    return {
      tenants: new InMemoryTenantRepository(),
      users,
      memberships,
      roles,
      administration: new InMemoryTenantAdministration(memberships, roles, users),
    };
  }
}
