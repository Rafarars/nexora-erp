import { describe } from 'vitest';
import { InMemoryJournalEntryRepository } from './in-memory-journal-entry.repository.js';
import {
  describeJournalEntryRepositoryContract,
  JournalEntryRepositoryHarness,
} from '../../testing/journal-entry-repository.contract.js';

describe('InMemoryJournalEntryRepository', () => {
  describeJournalEntryRepositoryContract('in-memory', async (): Promise<JournalEntryRepositoryHarness> => {
    const repository = new InMemoryJournalEntryRepository();
    return {
      repository,
      async reset(): Promise<void> {
        // En memoria, nueva instancia limpia por test
      },
      async createAccount(_tenantId: string, _id: string, _code: string): Promise<void> {
        // En memoria no requiere FKs
      },
    };
  });
});
