import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  TooManyRequestsError,
  InvalidArgumentError,
  NotFoundError,
  UnauthorizedError,
} from '../../domain/domain.error.js';

function statusFor(error: DomainError): number {
  if (error instanceof NotFoundError) return HttpStatus.NOT_FOUND;
  if (error instanceof ConflictError) return HttpStatus.CONFLICT;
  if (error instanceof InvalidArgumentError) return HttpStatus.BAD_REQUEST;
  if (error instanceof UnauthorizedError) return HttpStatus.UNAUTHORIZED;
  if (error instanceof ForbiddenError) return HttpStatus.FORBIDDEN;
  if (error instanceof TooManyRequestsError) return HttpStatus.TOO_MANY_REQUESTS;

  return HttpStatus.INTERNAL_SERVER_ERROR;
}

@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainErrorFilter.name);

  catch(error: DomainError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = statusFor(error);

    // El detalle queda en el registro; al cliente solo le llega el mensaje publico,
    // que no lleva identificadores internos ni devuelve lo que se recibio.
    this.logger.debug(`${error.name}: ${error.message}`);

    response.status(status).json({
      statusCode: status,
      error: error.name,
      message: error.publicMessage,
    });
  }
}
