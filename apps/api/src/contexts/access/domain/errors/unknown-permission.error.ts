import { InvalidArgumentError } from '../../../../shared/domain/domain.error.js';

export class UnknownPermissionError extends InvalidArgumentError {
  constructor(code: string) {
    super(`Permission <${code}> is not declared in the catalog.`);
  }
}
