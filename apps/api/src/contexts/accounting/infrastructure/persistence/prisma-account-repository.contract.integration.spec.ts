import { afterAll } from 'vitest';
import { describeAccountRepositoryContract } from '../../testing/account-repository.contract.js';
import { PrismaAccountRepositoryHarness } from '../testing/prisma-account-repository.harness.js';

const harness = new PrismaAccountRepositoryHarness();

afterAll(async () => {
  await harness.close();
});

describeAccountRepositoryContract('PrismaAccountRepository', async () => harness);
