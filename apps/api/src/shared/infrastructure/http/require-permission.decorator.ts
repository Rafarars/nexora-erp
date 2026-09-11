import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSION = 'nexora:permission';

// El permiso se declara junto al endpoint que lo exige, no en una tabla aparte que
// haya que mantener sincronizada a mano.
export const RequirePermission = (permission: string) =>
  SetMetadata(REQUIRED_PERMISSION, permission);
