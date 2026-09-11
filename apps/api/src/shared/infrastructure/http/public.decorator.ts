import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'nexora:public';

// Abrir un endpoint es una decision explicita y visible en el codigo. Sin esto, el
// guardian deniega: olvidar la declaracion cierra la puerta, no la abre.
export const Public = () => SetMetadata(IS_PUBLIC, true);
