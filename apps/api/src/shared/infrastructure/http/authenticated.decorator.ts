import { SetMetadata } from '@nestjs/common';

export const AUTHENTICATED_ONLY = 'nexora:authenticated';

// Para lo que exige sesion valida pero ningun permiso concreto: cambiar de empresa,
// ver el propio perfil, cerrar sesion. Sigue siendo una declaracion explicita; lo que
// no se declara, se deniega.
export const AuthenticatedOnly = () => SetMetadata(AUTHENTICATED_ONLY, true);
