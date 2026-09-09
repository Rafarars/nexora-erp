import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { IdGenerator } from '../domain/ports/id-generator.js';

@Injectable()
export class CryptoIdGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}
