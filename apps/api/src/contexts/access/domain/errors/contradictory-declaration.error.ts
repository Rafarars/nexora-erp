import { ForbiddenError } from '../../../../shared/domain/domain.error.js';

// Declarar a la vez `@Public()` y `@RequirePermission()` —tipicamente uno en la clase
// y otro en el metodo— no significa nada claro. Se cierra: la duda nunca abre.
export class ContradictoryDeclarationError extends ForbiddenError {
  constructor(handler: string) {
    super(`${handler} declares more than one access rule and they contradict each other.`);
  }
}
