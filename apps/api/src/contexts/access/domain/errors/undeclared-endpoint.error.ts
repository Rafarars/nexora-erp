import { ForbiddenError } from '../../../../shared/domain/domain.error.js';

// No es un error del usuario: es un endpoint que llego a produccion sin decidir quien
// puede usarlo. Se cierra en vez de abrirse, y el nombre lo delata en los registros.
export class UndeclaredEndpointError extends ForbiddenError {
  constructor(handler: string) {
    super(`${handler} declares no permission and is not marked as public.`);
  }
}
