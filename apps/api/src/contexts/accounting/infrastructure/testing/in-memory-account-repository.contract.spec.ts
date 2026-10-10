import { describeAccountRepositoryContract } from '../../testing/account-repository.contract.js';
import { InMemoryAccountRepository } from './in-memory-account.repository.js';

describeAccountRepositoryContract('InMemoryAccountRepository', async () => {
  const repository = new InMemoryAccountRepository();
  return {
    repository,
    reset: async () => {
      repository.clear();
    },
  };
});
