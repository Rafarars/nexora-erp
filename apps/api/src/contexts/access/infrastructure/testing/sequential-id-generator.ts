import { IdGenerator } from '../../../../shared/domain/ports/id-generator.js';

// Identificadores predecibles y validos: una prueba puede afirmar cual salio sin
// tener que capturarlo primero.
export class SequentialIdGenerator implements IdGenerator {
  private issued = 0;

  next(): string {
    this.issued += 1;

    const tail = this.issued.toString().padStart(12, '0');

    return `00000000-0000-4000-8000-${tail}`;
  }
}
