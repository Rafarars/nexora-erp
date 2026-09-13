import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

// Valida el cuerpo en la frontera con el mismo zod que valida el entorno, en vez de
// sembrar el DTO de decoradores. El dominio vuelve a validar por su cuenta: esto es
// para responder 400 con un mensaje util, no para protegerlo.
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      // Los campos que fallaron, sin el texto de zod: la interfaz decide como decirlo en
      // el idioma de quien usa el sistema.
      const fields = [
        ...new Set(result.error.issues.map((issue) => issue.path.join('.') || '(body)')),
      ];

      throw new BadRequestException({
        statusCode: 400,
        error: 'ValidationError',
        message: 'The request contains invalid data.',
        fields,
      });
    }

    return result.data;
  }
}
