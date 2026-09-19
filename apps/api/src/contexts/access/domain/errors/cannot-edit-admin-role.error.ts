import { ConflictError } from '../../../../shared/domain/domain.error.js';

// La pantalla ya escondia el boton de editar este rol, pero la regla vivia solo alli: por
// la API se le podia cambiar el nombre y seguia concediendolo todo. Un rol llamado
// "Consulta" que abre la empresa entera es peor que no tener la proteccion.
export class CannotEditAdminRoleError extends ConflictError {
  constructor() {
    super(
      'The administrator role cannot be edited.',
      'The administrator role cannot be edited: it always grants every permission.',
    );
  }
}
