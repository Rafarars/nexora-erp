import {
  AccessRepositories,
  AccessRepositoriesHarness,
} from '../../testing/access-repositories.harness.js';
import { InMemoryMembershipRepository } from './in-memory-membership.repository.js';
import { InMemoryRoleRepository } from './in-memory-role.repository.js';
import { InMemoryTenantRepository } from './in-memory-tenant.repository.js';
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
    return {
      tenants: new InMemoryTenantRepository(),
      users: new InMemoryUserRepository(),
      memberships: new InMemoryMembershipRepository(),
      roles: new InMemoryRoleRepository(),
    };
  }
}
