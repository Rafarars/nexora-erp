import { InvalidArgumentError } from '../../../../shared/domain/domain.error.js';
import { BoundedText } from '../shared/bounded-text.vo.js';

export class InvalidAbbreviationError extends InvalidArgumentError {
  constructor(value: string) {
    super(`An abbreviation cannot contain spaces, received <${value}>.`, 'The abbreviation cannot contain spaces.');
  }
}

// Se imprime pegada a la cantidad (`12 cja`): un espacio dentro la partiria en dos.
export class UnitAbbreviation extends BoundedText {
  private constructor(value: string) {
    super(value, 10);

    if (/\s/.test(this.value)) {
      throw new InvalidAbbreviationError(this.value);
    }
  }

  static of(value: string): UnitAbbreviation {
    return new UnitAbbreviation(value);
  }
}
