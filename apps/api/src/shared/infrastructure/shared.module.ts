import { Module } from '@nestjs/common';
import { CLOCK } from '../domain/ports/clock.js';
import { ID_GENERATOR } from '../domain/ports/id-generator.js';
import { CryptoIdGenerator } from './crypto-id-generator.js';
import { SystemClock } from './system-clock.js';

@Module({
  providers: [
    { provide: ID_GENERATOR, useClass: CryptoIdGenerator },
    { provide: CLOCK, useClass: SystemClock },
  ],
  exports: [ID_GENERATOR, CLOCK],
})
export class SharedModule {}
