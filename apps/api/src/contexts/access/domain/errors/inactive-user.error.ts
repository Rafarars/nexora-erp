import { UnauthorizedError } from '../../../../shared/domain/domain.error.js';

export class InactiveUserError extends UnauthorizedError {
  constructor(userId: string) {
    super(`User <${userId}> is not active.`, 'This account is not active.');
  }
}
