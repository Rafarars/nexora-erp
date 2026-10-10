import { afterAll, describe } from 'vitest';
import { PrismaJournalEntryRepositoryHarness } from '../testing/prisma-journal-entry-repository.harness.js';
import { describeJournalEntryRepositoryContract } from '../../testing/journal-entry-repository.contract.js';

describe('PrismaJournalEntryRepository integration', () => {
  let harness: PrismaJournalEntryRepositoryHarness | null = null;

  afterAll(async () => {
    if (harness) {
      await harness.close();
    }
  });

  describeJournalEntryRepositoryContract('prisma', async () => {
    if (!harness) {
      harness = new PrismaJournalEntryRepositoryHarness();
    }
    return harness;
  });
});
